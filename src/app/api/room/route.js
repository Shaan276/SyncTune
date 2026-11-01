import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_ROOM_QUEUE = [
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg', duration: 282 },
  { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', thumbnail: 'https://img.youtube.com/vi/2Vv-BfVoq4g/mqdefault.jpg', duration: 263 },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg', duration: 233 },
  { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', thumbnail: 'https://img.youtube.com/vi/TUVcZfQe-Kw/mqdefault.jpg', duration: 203 },
  { id: 'H5v3kku4y6Q', title: 'As It Was', artist: 'Harry Styles', thumbnail: 'https://img.youtube.com/vi/H5v3kku4y6Q/mqdefault.jpg', duration: 167 },
  { id: 'kTJczUoc268', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', thumbnail: 'https://img.youtube.com/vi/kTJczUoc268/mqdefault.jpg', duration: 141 },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg', duration: 359 },
  { id: '7wtfhZwyrcc', title: 'Believer', artist: 'Imagine Dragons', thumbnail: 'https://img.youtube.com/vi/7wtfhZwyrcc/mqdefault.jpg', duration: 204 }
];

// In-memory global store for rooms across requests
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

function advanceRoomToNextSong(room) {
  if (!room.queue || room.queue.length === 0) {
    room.queue = [...DEFAULT_ROOM_QUEUE];
  }
  // Sort queue by upvotes descending
  room.queue.sort((a, b) => (room.queueVotes[b.id] || 0) - (room.queueVotes[a.id] || 0));

  const nextSong = room.queue.shift();
  if (nextSong) {
    delete room.queueVotes[nextSong.id];
    room.currentSong = nextSong;
    room.currentTime = 0;
    room.isPlaying = true;
    room.lastUpdated = Date.now();
  } else {
    room.currentSong = null;
    room.currentTime = 0;
    room.isPlaying = false;
  }
  return room.currentSong;
}

function getOrCreateRoom(code, user = null) {
  if (!roomsStore[code]) {
    roomsStore[code] = {
      code,
      host_name: user?.username || 'Host',
      host_id: user?.id || 'host',
      isPrivate: true,
      allowListenerControl: true,
      controlMode: 'collaborative',
      members: user ? [{ id: user.id, username: user.username, isHost: true, isOnline: true }] : [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      chats: [],
      queue: [...DEFAULT_ROOM_QUEUE],
      queueVotes: {}
    };
  }
  if (!roomsStore[code].queue) {
    roomsStore[code].queue = [...DEFAULT_ROOM_QUEUE];
  }
  if (!roomsStore[code].queueVotes) {
    roomsStore[code].queueVotes = {};
  }
  return roomsStore[code];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const rawCode = searchParams.get('code');
  const code = normalizeRoomCode(rawCode);

  // 1. List Rooms
  if (action === 'list') {
    const list = Object.values(roomsStore).map((r) => ({
      code: r.code,
      host_name: r.host_name,
      member_count: (r.members || []).length,
      song_title: r.currentSong?.title || 'No song playing',
      song_artist: r.currentSong?.artist || 'SyncTune',
      is_playing: r.isPlaying ? 1 : 0,
      isPrivate: true,
      allowListenerControl: r.allowListenerControl !== false,
      controlMode: r.allowListenerControl === false ? 'host_only' : 'collaborative'
    }));
    return NextResponse.json({ success: true, rooms: list });
  }

  // 2. Get Room Status
  if (action === 'get' && code) {
    const room = getOrCreateRoom(code);

    let currentCalculatedTime = room.currentTime || 0;
    if (room.isPlaying && room.lastUpdated) {
      const elapsed = Math.max(0, (Date.now() - room.lastUpdated) / 1000);
      currentCalculatedTime += elapsed;
      const trackDur = room.currentSong?.duration || 180;
      if (currentCalculatedTime >= trackDur) {
        // Song completed! Automatically advance room to next upvoted track
        advanceRoomToNextSong(room);
        currentCalculatedTime = 0;
      }
    }

    return NextResponse.json({
      success: true,
      room: {
        ...room,
        currentTime: currentCalculatedTime,
        queue: room.queue || DEFAULT_ROOM_QUEUE
      },
      members: room.members || [],
      currentSong: room.currentSong,
      isPlaying: Boolean(room.isPlaying),
      currentTime: currentCalculatedTime,
      lastUpdated: room.lastUpdated || Date.now(),
      chats: room.chats || [],
      queue: room.queue || DEFAULT_ROOM_QUEUE,
      queueVotes: room.queueVotes || {},
      isPrivate: true,
      allowListenerControl: room.allowListenerControl !== false,
      controlMode: room.allowListenerControl === false ? 'host_only' : 'collaborative'
    });
  }

  return NextResponse.json({ success: true, rooms: Object.values(roomsStore) });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'join';
    const user = body.user || { id: Date.now(), username: body.username || 'Listener' };

    // 1. CREATE ROOM
    if (action === 'create') {
      let code = normalizeRoomCode(body.code);
      if (!code) {
        code = generateUniqueCode();
        while (roomsStore[code]) {
          code = generateUniqueCode();
        }
      }

      const allowListenerControl = body.allowListenerControl !== undefined ? Boolean(body.allowListenerControl) : true;

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
        chats: [],
        queue: [...DEFAULT_ROOM_QUEUE],
        queueVotes: {}
      };

      return NextResponse.json({
        success: true,
        code,
        room: roomsStore[code],
        members: roomsStore[code].members
      });
    }

    // 2. JOIN ROOM
    if (action === 'join') {
      const code = normalizeRoomCode(body.code);
      if (!code) {
        return NextResponse.json({ success: false, error: 'Please enter a room code.' }, { status: 400 });
      }

      const room = getOrCreateRoom(code, user);

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
        queue: room.queue || DEFAULT_ROOM_QUEUE,
        queueVotes: room.queueVotes || {},
        allowListenerControl: room.allowListenerControl !== false,
        controlMode: room.allowListenerControl === false ? 'host_only' : 'collaborative'
      });
    }

    const code = normalizeRoomCode(body.code);
    if (!code) {
      return NextResponse.json({ success: false, error: 'Room code required.' }, { status: 400 });
    }

    const room = getOrCreateRoom(code, user);

    // 3. BROADCAST SYNC / STATE REPLICATION
    if (action === 'sync') {
      if (body.currentSong !== undefined) room.currentSong = body.currentSong;
      if (body.isPlaying !== undefined) room.isPlaying = Boolean(body.isPlaying);
      if (body.currentTime !== undefined) room.currentTime = body.currentTime;
      if (body.host_name) room.host_name = body.host_name;
      if (body.allowListenerControl !== undefined) room.allowListenerControl = Boolean(body.allowListenerControl);
      if (body.queueVotes) room.queueVotes = body.queueVotes;
      if (body.chats && Array.isArray(body.chats)) {
        room.chats = body.chats.slice(-50);
      }
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // 4. PLAY SONG IN ROOM
    if (action === 'play') {
      if (body.song) {
        if (room.queue) {
          room.queue = room.queue.filter((s) => s.id !== body.song.id);
        }
        delete room.queueVotes[body.song.id];
        room.currentSong = body.song;
        room.isPlaying = true;
        room.currentTime = body.currentTime || 0;
        room.lastUpdated = Date.now();
        return NextResponse.json({ success: true, room });
      }
    }

    // 5. NEXT / SKIP TO NEXT QUEUE SONG IN ROOM
    if (action === 'next') {
      advanceRoomToNextSong(room);
      return NextResponse.json({
        success: true,
        room,
        currentSong: room.currentSong,
        queue: room.queue || DEFAULT_ROOM_QUEUE,
        queueVotes: room.queueVotes || {}
      });
    }

    // 6. ADD TO ROOM QUEUE
    if (action === 'add_queue') {
      if (body.song && body.song.id) {
        if (!room.queue) room.queue = [...DEFAULT_ROOM_QUEUE];
        const exists = room.queue.some((s) => s.id === body.song.id);
        if (!exists && (!room.currentSong || room.currentSong.id !== body.song.id)) {
          room.queue.push(body.song);
        }
        return NextResponse.json({ success: true, queue: room.queue });
      }
    }

    // 7. UPVOTE IN ROOM
    if (action === 'upvote') {
      if (body.songId) {
        room.queueVotes[body.songId] = (room.queueVotes[body.songId] || 0) + 1;
        // Keep queue sorted by upvotes
        if (room.queue) {
          room.queue.sort((a, b) => (room.queueVotes[b.id] || 0) - (room.queueVotes[a.id] || 0));
        }
        return NextResponse.json({ success: true, votes: room.queueVotes, queue: room.queue });
      }
    }

    // 8. PAUSE / RESUME IN ROOM
    if (action === 'pause' || action === 'resume') {
      room.isPlaying = action === 'resume';
      if (body.currentTime !== undefined) {
        room.currentTime = body.currentTime;
      }
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // 9. SEEK IN ROOM
    if (action === 'seek') {
      room.currentTime = body.currentTime || 0;
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // 10. CHAT MESSAGE IN ROOM
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

    // 11. LEAVE ROOM
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
