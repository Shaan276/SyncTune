import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory global store for rooms
if (!global._synctune_rooms) {
  global._synctune_rooms = {};
}

const roomsStore = global._synctune_rooms;

function normalizeRoomCode(input) {
  if (!input) return '';
  let cleaned = String(input).toUpperCase().replace(/[\s-]+/g, '');
  if (/^\d{4}$/.test(cleaned)) {
    return `SYNC${cleaned}`;
  }
  return cleaned;
}

function generateUniqueCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SYNC${num}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const code = normalizeRoomCode(searchParams.get('code'));

  // 1. List Public Rooms
  if (action === 'list') {
    const list = Object.values(roomsStore)
      .filter((r) => !r.isPrivate)
      .map((r) => ({
        code: r.code,
        host_name: r.host_name,
        member_count: (r.members || []).length,
        song_title: r.currentSong?.title || 'No song playing',
        song_artist: r.currentSong?.artist || 'SyncTune',
        is_playing: r.isPlaying ? 1 : 0,
        isPrivate: false,
        allowListenerControl: r.allowListenerControl !== false,
        controlMode: r.allowListenerControl === false ? 'host_only' : 'collaborative'
      }));
    return NextResponse.json({ success: true, rooms: list });
  }

  // 2. Get specific room status
  if (action === 'get' && code) {
    const room = roomsStore[code];
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // Calculate real-time elapsed playback position if playing
    let currentCalculatedTime = room.currentTime || 0;
    if (room.isPlaying && room.lastUpdated) {
      const elapsed = Math.max(0, (Date.now() - room.lastUpdated) / 1000);
      currentCalculatedTime += elapsed;
      if (room.currentSong?.duration && currentCalculatedTime > room.currentSong.duration) {
        currentCalculatedTime = room.currentSong.duration;
      }
    }

    return NextResponse.json({
      success: true,
      room: {
        ...room,
        currentTime: currentCalculatedTime
      },
      members: room.members || [],
      currentSong: room.currentSong,
      isPlaying: Boolean(room.isPlaying),
      currentTime: currentCalculatedTime,
      lastUpdated: room.lastUpdated || Date.now(),
      chats: room.chats || [],
      queueVotes: room.queueVotes || {},
      isPrivate: Boolean(room.isPrivate),
      allowListenerControl: room.allowListenerControl !== false,
      controlMode: room.allowListenerControl === false ? 'host_only' : 'collaborative'
    });
  }

  return NextResponse.json({ success: true, rooms: Object.values(roomsStore).filter(r => !r.isPrivate) });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'join';
    const user = body.user || { id: Date.now(), username: body.username || 'Listener' };
    const isPrivate = Boolean(body.isPrivate);

    // CREATE ROOM
    if (action === 'create') {
      let code = normalizeRoomCode(body.code);
      if (!code) {
        code = generateUniqueCode();
        while (roomsStore[code]) {
          code = generateUniqueCode();
        }
      }

      const allowListenerControl = body.allowListenerControl !== undefined ? Boolean(body.allowListenerControl) : false;

      roomsStore[code] = {
        code,
        host_name: user.username || 'Host',
        host_id: user.id,
        isPrivate: true,
        allowListenerControl,
        controlMode: allowListenerControl ? 'collaborative' : 'host_only',
        members: [
          { id: user.id, username: user.username, isHost: true, isOnline: true }
        ],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        chats: roomsStore[code]?.chats || [],
        queueVotes: roomsStore[code]?.queueVotes || {}
      };

      return NextResponse.json({
        success: true,
        code,
        room: roomsStore[code],
        members: roomsStore[code].members
      });
    }

    // JOIN ROOM
    if (action === 'join') {
      const code = normalizeRoomCode(body.code);
      if (!code) {
        return NextResponse.json({ success: false, error: 'Please enter a room code.' }, { status: 400 });
      }

      const room = roomsStore[code];
      if (!room) {
        return NextResponse.json({ success: false, error: `Room "${code}" not found. Please verify the code.` }, { status: 404 });
      }

      const existingMember = room.members.find((m) => String(m.id) === String(user.id));
      if (!existingMember) {
        room.members.push({
          id: user.id,
          username: user.username,
          isHost: String(user.id) === String(room.host_id),
          isOnline: true
        });
      }

      let currentCalculatedTime = room.currentTime || 0;
      if (room.isPlaying && room.lastUpdated) {
        const elapsed = Math.max(0, (Date.now() - room.lastUpdated) / 1000);
        currentCalculatedTime += elapsed;
      }

      return NextResponse.json({
        success: true,
        code,
        room: {
          ...room,
          currentTime: currentCalculatedTime
        },
        members: room.members,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        currentTime: currentCalculatedTime,
        allowListenerControl: room.allowListenerControl !== false,
        controlMode: room.allowListenerControl === false ? 'host_only' : 'collaborative'
      });
    }

    const code = normalizeRoomCode(body.code);
    const room = roomsStore[code];
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const isHost = String(room.host_id) === String(user.id);
    const canControl = room.allowListenerControl !== false || isHost;

    // PLAY SONG IN ROOM
    if (action === 'play') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: 'Only the room host can control music playback in this room.' }, { status: 403 });
      }
      if (body.song) {
        room.currentSong = body.song;
        room.isPlaying = true;
        room.currentTime = body.currentTime || 0;
        room.lastUpdated = Date.now();
        return NextResponse.json({ success: true, room });
      }
    }

    // PAUSE / RESUME IN ROOM
    if (action === 'pause' || action === 'resume') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: 'Only the room host can control music playback in this room.' }, { status: 403 });
      }
      room.isPlaying = action === 'resume';
      if (body.currentTime !== undefined) {
        room.currentTime = body.currentTime;
      }
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // SEEK IN ROOM
    if (action === 'seek') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: 'Only the room host can control music playback in this room.' }, { status: 403 });
      }
      room.currentTime = body.currentTime || 0;
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // CHAT MESSAGE IN ROOM
    if (action === 'chat') {
      if (body.message) {
        if (!room.chats) room.chats = [];
        const chatItem = {
          id: String(Date.now()) + '_' + Math.random().toString(36).substring(2, 6),
          sender: user.username || body.username || 'Listener',
          message: body.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        room.chats.push(chatItem);
        if (room.chats.length > 50) room.chats.shift();
        return NextResponse.json({ success: true, chat: chatItem, chats: room.chats });
      }
    }

    // UPVOTE IN ROOM
    if (action === 'upvote') {
      if (body.songId) {
        room.queueVotes[body.songId] = (room.queueVotes[body.songId] || 0) + 1;
        return NextResponse.json({ success: true, votes: room.queueVotes });
      }
    }

    // LEAVE ROOM
    if (action === 'leave') {
      room.members = room.members.filter((m) => String(m.id) !== String(user.id));
      if (room.members.length === 0) {
        delete roomsStore[code];
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, room });
  } catch (err) {
    console.error("Room API Error:", err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
