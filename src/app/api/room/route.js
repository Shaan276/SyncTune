import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory global store for rooms
if (!global._synctune_rooms) {
  global._synctune_rooms = {};
}

const roomsStore = global._synctune_rooms;

function generateUniqueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SYNC-${code}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const code = (searchParams.get('code') || '').toUpperCase().trim();

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
        isPrivate: false
      }));
    return NextResponse.json({ success: true, rooms: list });
  }

  // 2. Get specific room status
  if (action === 'get' && code) {
    const room = roomsStore[code];
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      room,
      members: room.members || [],
      currentSong: room.currentSong,
      isPlaying: Boolean(room.isPlaying),
      currentTime: room.currentTime || 0,
      lastUpdated: room.lastUpdated || Date.now(),
      chats: room.chats || [],
      queueVotes: room.queueVotes || {},
      isPrivate: Boolean(room.isPrivate)
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
      let code = (body.code || '').toUpperCase().trim();
      if (!code || roomsStore[code]) {
        code = generateUniqueCode();
        while (roomsStore[code]) {
          code = generateUniqueCode();
        }
      }

      roomsStore[code] = {
        code,
        host_name: user.username || 'Host',
        host_id: user.id,
        isPrivate,
        members: [
          { id: user.id, username: user.username, isHost: true, isOnline: true }
        ],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        chats: [],
        queueVotes: {}
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
      const code = (body.code || '').toUpperCase().trim();
      if (!code) {
        return NextResponse.json({ success: false, error: 'Please enter a room code.' }, { status: 400 });
      }

      const room = roomsStore[code];
      if (!room) {
        return NextResponse.json({ success: false, error: `Room "${code}" not found. Please verify the code.` }, { status: 404 });
      }

      const existingMember = room.members.find((m) => m.id === user.id);
      if (!existingMember) {
        room.members.push({
          id: user.id,
          username: user.username,
          isHost: false,
          isOnline: true
        });
      }

      return NextResponse.json({
        success: true,
        code,
        room,
        members: room.members,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime
      });
    }

    const code = (body.code || '').toUpperCase().trim();
    const room = roomsStore[code];
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // PLAY SONG IN ROOM
    if (action === 'play') {
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
      room.isPlaying = action === 'resume';
      if (body.currentTime !== undefined) {
        room.currentTime = body.currentTime;
      }
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // SEEK IN ROOM
    if (action === 'seek') {
      room.currentTime = body.currentTime || 0;
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // CHAT MESSAGE IN ROOM
    if (action === 'chat') {
      if (body.message) {
        const chatItem = {
          id: Date.now(),
          sender: user.username || 'Listener',
          message: body.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        room.chats.push(chatItem);
        if (room.chats.length > 50) room.chats.shift();
        return NextResponse.json({ success: true, chat: chatItem });
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
      room.members = room.members.filter((m) => m.id !== user.id);
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
