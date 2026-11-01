import { NextResponse } from 'next/server';
import EventEmitter from 'events';

export const dynamic = 'force-dynamic';

const CLOUD_ROOMS_BIN = 'https://extendsclass.com/api/json-storage/bin/fdddbaf';

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

if (!global._synctune_rooms) {
  global._synctune_rooms = {};
}
const roomsStore = global._synctune_rooms;

if (!global._synctune_room_events) {
  global._synctune_room_events = new EventEmitter();
  global._synctune_room_events.setMaxListeners(300);
}
const roomEvents = global._synctune_room_events;

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

function getISTTimestamp() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date());
}

function getVoteScore(v) {
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'number') return v;
  return v ? 1 : 0;
}

async function getCloudRooms() {
  try {
    const res = await fetch(`${CLOUD_ROOMS_BIN}?_t=${Date.now()}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      return (data && typeof data.rooms === 'object' && data.rooms) ? data.rooms : {};
    }
  } catch (e) {
    console.warn('Cloud rooms fetch warning:', e.message);
  }
  return {};
}

async function syncRoomToCloud(room) {
  try {
    const existing = await getCloudRooms();
    if (room && room.code) {
      if (!room.members || room.members.length === 0) {
        delete existing[room.code];
      } else {
        const { _lastCloudFetch, ...saveableRoom } = room;
        existing[room.code] = saveableRoom;
      }
    }
    await fetch(CLOUD_ROOMS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: existing })
    });
  } catch (e) {
    console.warn('Cloud rooms save warning:', e.message);
  }
}

async function getOrCreateRoom(code, user = null, forceCloud = false) {
  const now = Date.now();
  if (!roomsStore[code] || forceCloud || (now - (roomsStore[code]._lastCloudFetch || 0) > 2000)) {
    try {
      const cloudRooms = await getCloudRooms();
      if (cloudRooms && cloudRooms[code]) {
        const cloudRoom = cloudRooms[code];
        if (!roomsStore[code] || (cloudRoom.version || 0) >= (roomsStore[code].version || 0)) {
          roomsStore[code] = { ...cloudRoom, _lastCloudFetch: now };
        }
      }
    } catch (e) {}
  }

  if (!roomsStore[code]) {
    roomsStore[code] = {
      code,
      host_name: user?.username || 'Host',
      host_id: user?.id || 'host',
      isPrivate: true,
      allowListenerControl: true, // Collaborative by default; host can switch to host-only
      controlMode: 'collaborative',
      members: user ? [{ id: user.id, username: user.username, isHost: true, isOnline: true }] : [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      version: 1,
      lastEvent: null,
      chats: [],
      queue: [...DEFAULT_ROOM_QUEUE],
      queueVotes: {},
      _lastCloudFetch: now
    };
  }
  if (!roomsStore[code].queue) roomsStore[code].queue = [...DEFAULT_ROOM_QUEUE];
  if (!roomsStore[code].queueVotes) roomsStore[code].queueVotes = {};
  if (!roomsStore[code].version) roomsStore[code].version = 1;
  return roomsStore[code];
}

function advanceRoomToNextSong(room) {
  if (!room.queue || room.queue.length === 0) {
    room.queue = [...DEFAULT_ROOM_QUEUE];
  }
  room.queue.sort((a, b) => getVoteScore(room.queueVotes[b.id]) - getVoteScore(room.queueVotes[a.id]));

  const nextSong = room.queue.shift();
  if (nextSong) {
    delete room.queueVotes[nextSong.id];
    room.currentSong = nextSong;
    room.currentTime = 0;
    room.isPlaying = true;
    room.lastUpdated = Date.now();
    room.version = (room.version || 0) + 1;
    room.lastEvent = {
      type: 'TRACK_CHANGE',
      song: nextSong,
      time: 0,
      version: room.version,
      triggeredBy: 'AutoQueue'
    };
  } else {
    room.currentSong = null;
    room.currentTime = 0;
    room.isPlaying = false;
    room.version = (room.version || 0) + 1;
    room.lastEvent = {
      type: 'PAUSE',
      time: 0,
      version: room.version,
      triggeredBy: 'AutoQueueEnd'
    };
  }

  notifyRoomListeners(room);
  syncRoomToCloud(room);
  return room.currentSong;
}

function notifyRoomListeners(room) {
  roomEvents.emit(`room_update_${room.code}`, {
    event: room.lastEvent,
    version: room.version,
    room: getSanitizedRoom(room)
  });
}

function getSanitizedRoom(room) {
  let currentCalculatedTime = room.currentTime || 0;
  if (room.isPlaying && room.lastUpdated) {
    const elapsed = Math.max(0, (Date.now() - room.lastUpdated) / 1000);
    currentCalculatedTime += elapsed;
    const trackDur = room.currentSong?.duration || 180;
    if (currentCalculatedTime >= trackDur) {
      currentCalculatedTime = trackDur;
    }
  }

  return {
    code: room.code,
    host_name: room.host_name,
    host_id: room.host_id,
    isPrivate: true,
    allowListenerControl: room.allowListenerControl !== false,
    controlMode: room.allowListenerControl === false ? 'host_only' : 'collaborative',
    members: room.members || [],
    currentSong: room.currentSong,
    isPlaying: Boolean(room.isPlaying),
    currentTime: currentCalculatedTime,
    lastUpdated: room.lastUpdated || Date.now(),
    version: room.version || 1,
    queue: room.queue || DEFAULT_ROOM_QUEUE,
    queueVotes: room.queueVotes || {},
    chats: (room.chats || []).slice(-50)
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = (searchParams.get('action') || 'list').toLowerCase();
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

  // 2. Full Room State
  if (action === 'get' && code) {
    const room = await getOrCreateRoom(code);
    return NextResponse.json({
      success: true,
      room: getSanitizedRoom(room),
      members: room.members || [],
      currentSong: room.currentSong,
      isPlaying: Boolean(room.isPlaying),
      currentTime: room.currentTime || 0,
      version: room.version || 1,
      queue: room.queue || DEFAULT_ROOM_QUEUE,
      queueVotes: room.queueVotes || {}
    });
  }

  // 3. Event Ping Listener (Zero Polling Hammering)
  if (action === 'ping' && code) {
    const clientVersion = parseInt(searchParams.get('version') || '0', 10);
    const room = await getOrCreateRoom(code);

    // If room already has a newer event than client's version, return immediately!
    if ((room.version || 0) > clientVersion && room.lastEvent) {
      return NextResponse.json({
        success: true,
        hasUpdate: true,
        version: room.version,
        event: room.lastEvent,
        room: getSanitizedRoom(room)
      });
    }

    // Otherwise wait for next event (up to 7.5 seconds)
    return new Promise((resolve) => {
      let resolved = false;

      const onUpdate = (payload) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        roomEvents.removeListener(`room_update_${code}`, onUpdate);
        resolve(
          NextResponse.json({
            success: true,
            hasUpdate: true,
            version: payload.version,
            event: payload.event,
            room: payload.room
          })
        );
      };

      const timer = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        roomEvents.removeListener(`room_update_${code}`, onUpdate);

        const currentRoom = await getOrCreateRoom(code);
        if ((currentRoom.version || 0) > clientVersion && currentRoom.lastEvent) {
          resolve(
            NextResponse.json({
              success: true,
              hasUpdate: true,
              version: currentRoom.version,
              event: currentRoom.lastEvent,
              room: getSanitizedRoom(currentRoom)
            })
          );
        } else {
          resolve(
            NextResponse.json({
              success: true,
              hasUpdate: false,
              version: currentRoom.version || 0
            })
          );
        }
      }, 7500);

      roomEvents.once(`room_update_${code}`, onUpdate);
    });
  }

  return NextResponse.json({ success: true, rooms: Object.values(roomsStore) });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || 'join').toLowerCase();
    const user = body.user || { id: Date.now(), username: body.username || 'Listener' };
    const code = normalizeRoomCode(body.code);

    // 1. CREATE ROOM
    if (action === 'create') {
      let roomCode = code || generateUniqueCode();
      while (roomsStore[roomCode]) {
        roomCode = generateUniqueCode();
      }

      const allowListenerControl = body.allowListenerControl !== undefined ? Boolean(body.allowListenerControl) : true;
      const initialQueue = (Array.isArray(body.queue) && body.queue.length > 0) ? body.queue : [...DEFAULT_ROOM_QUEUE];

      const newRoom = {
        code: roomCode,
        host_name: user.username || 'Host',
        host_id: user.id,
        isPrivate: true,
        allowListenerControl,
        controlMode: allowListenerControl ? 'collaborative' : 'host_only',
        members: [{ id: user.id, username: user.username, isHost: true, isOnline: true }],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        version: 1,
        lastEvent: null,
        chats: [
          {
            id: `sys_create_${Date.now()}`,
            sender: 'System',
            isSystem: true,
            message: `🎉 Room created by ${user.username || 'Host'}`,
            timestamp: getISTTimestamp()
          }
        ],
        queue: initialQueue,
        queueVotes: {}
      };

      roomsStore[roomCode] = newRoom;
      await syncRoomToCloud(newRoom);

      return NextResponse.json({
        success: true,
        code: roomCode,
        room: getSanitizedRoom(newRoom),
        members: newRoom.members
      });
    }

    if (!code) {
      return NextResponse.json({ success: false, error: 'Room code required.' }, { status: 400 });
    }

    const room = await getOrCreateRoom(code, user);

    // Check permissions
    const isHost = String(room.host_id) === String(user.id) || (room.members || []).some((m) => String(m.id) === String(user.id) && m.isHost);
    const canControl = room.allowListenerControl !== false || isHost;

    // 2. JOIN ROOM
    if (action === 'join') {
      if (!room.members) room.members = [];
      const currentUserId = String(user.id);
      const currentUserName = String(user.username || 'Listener');

      const existingMember = room.members.find(
        (m) => String(m.id) === currentUserId || (m.username && m.username.toLowerCase() === currentUserName.toLowerCase())
      );

      const isRoomHost = String(user.id) === String(room.host_id);

      if (!existingMember) {
        room.members.push({
          id: user.id,
          username: user.username || 'Listener',
          isHost: isRoomHost,
          isOnline: true
        });

        // Add system message to room chat with IST timestamp
        if (!room.chats) room.chats = [];
        const joinChat = {
          id: `sys_join_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sender: 'System',
          isSystem: true,
          message: `👋 ${user.username || 'A listener'} joined the room`,
          timestamp: getISTTimestamp()
        };
        room.chats.push(joinChat);
        if (room.chats.length > 50) room.chats.shift();

        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'MEMBER_JOINED',
          user: { id: user.id, username: user.username },
          members: room.members,
          chat: joinChat,
          version: room.version
        };

        notifyRoomListeners(room);
        await syncRoomToCloud(room);
      } else {
        existingMember.isOnline = true;
      }

      return NextResponse.json({
        success: true,
        code,
        room: getSanitizedRoom(room),
        members: room.members,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime || 0,
        version: room.version || 1,
        queue: room.queue || DEFAULT_ROOM_QUEUE,
        queueVotes: room.queueVotes || {}
      });
    }

    // 3. PLAY NEW SONG IN ROOM
    if (action === 'play') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: '🔒 Only the room host can change music in this room.' }, { status: 403 });
      }
      if (body.song) {
        if (room.queue) {
          room.queue = room.queue.filter((s) => s.id !== body.song.id);
        }
        delete room.queueVotes[body.song.id];
        room.currentSong = body.song;
        room.isPlaying = true;
        room.currentTime = body.currentTime || 0;
        room.lastUpdated = Date.now();
        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'TRACK_CHANGE',
          song: body.song,
          time: room.currentTime,
          version: room.version,
          triggeredBy: user.username || 'Host',
          triggeredById: String(user.id || '')
        };

        notifyRoomListeners(room);
        await syncRoomToCloud(room);
        return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
      }
    }

    // 4. PAUSE SONG IN ROOM
    if (action === 'pause') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: '🔒 Only the room host can pause music.' }, { status: 403 });
      }
      room.isPlaying = false;
      if (body.currentTime !== undefined) {
        room.currentTime = body.currentTime;
      }
      room.lastUpdated = Date.now();
      room.version = (room.version || 0) + 1;
      room.lastEvent = {
        type: 'PAUSE',
        time: room.currentTime,
        version: room.version,
        triggeredBy: user.username || 'Host',
        triggeredById: String(user.id || '')
      };

        notifyRoomListeners(room);
        await syncRoomToCloud(room);
      return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
    }

    // 5. RESUME / PLAY CURRENT SONG IN ROOM
    if (action === 'resume' || action === 'play_current') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: '🔒 Only the room host can resume music.' }, { status: 403 });
      }
      room.isPlaying = true;
      if (body.currentTime !== undefined) {
        room.currentTime = body.currentTime;
      }
      room.lastUpdated = Date.now();
      room.version = (room.version || 0) + 1;
      room.lastEvent = {
        type: 'PLAY',
        time: room.currentTime,
        version: room.version,
        triggeredBy: user.username || 'Host',
        triggeredById: String(user.id || '')
      };

      notifyRoomListeners(room);
      await syncRoomToCloud(room);
      return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
    }

    // 6. SEEK / TIMELINE CHANGE IN ROOM (e.g. Slide 1:25 -> 3:27)
    if (action === 'seek') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: '🔒 Only the room host can seek timeline.' }, { status: 403 });
      }
      room.currentTime = Number(body.currentTime) || 0;
      room.lastUpdated = Date.now();
      room.version = (room.version || 0) + 1;
      room.lastEvent = {
        type: 'SEEK',
        time: room.currentTime,
        triggeredBy: user.username || 'Host',
        triggeredById: String(user.id || ''),
        version: room.version
      };

      notifyRoomListeners(room);
      syncRoomToCloud(room);
      return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
    }

    // 7. NEXT SONG IN ROOM
    if (action === 'next') {
      if (!canControl) {
        return NextResponse.json({ success: false, error: '🔒 Only the room host can skip tracks.' }, { status: 403 });
      }
      advanceRoomToNextSong(room);
      return NextResponse.json({
        success: true,
        room: getSanitizedRoom(room),
        currentSong: room.currentSong
      });
    }

    // 8. TOGGLE / SET CONTROL MODE (Host Only vs Everyone)
    if (action === 'set_control_mode') {
      if (!isHost) {
        return NextResponse.json({ success: false, error: 'Only the room host can change room permissions.' }, { status: 403 });
      }
      room.allowListenerControl = Boolean(body.allowListenerControl);
      room.controlMode = room.allowListenerControl ? 'collaborative' : 'host_only';
      room.version = (room.version || 0) + 1;
      room.lastEvent = {
        type: 'CONTROL_MODE_CHANGED',
        allowListenerControl: room.allowListenerControl,
        version: room.version,
        triggeredBy: user.username || 'Host'
      };

      notifyRoomListeners(room);
      syncRoomToCloud(room);
      return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
    }

    // 9. ADD TO ROOM QUEUE
    if (action === 'add_queue') {
      if (body.song && body.song.id) {
        if (!room.queue) room.queue = [...DEFAULT_ROOM_QUEUE];
        const exists = room.queue.some((s) => s.id === body.song.id);
        if (!exists && (!room.currentSong || room.currentSong.id !== body.song.id)) {
          room.queue.push(body.song);
        }
        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'QUEUE_UPDATED',
          queue: room.queue,
          version: room.version
        };
        notifyRoomListeners(room);
        syncRoomToCloud(room);
        return NextResponse.json({ success: true, queue: room.queue });
      }
    }

    // 10. UPVOTE SONG IN ROOM QUEUE (Collective 1 + 1 + 1 votes across all players)
    if (action === 'upvote') {
      if (body.songId) {
        if (!room.queueVotes || typeof room.queueVotes !== 'object') {
          room.queueVotes = {};
        }

        const voterId = String(user?.id || user?.email || user?.username || 'voter');
        let currentVoters = Array.isArray(room.queueVotes[body.songId])
          ? [...room.queueVotes[body.songId]]
          : (typeof room.queueVotes[body.songId] === 'number' && room.queueVotes[body.songId] > 0
            ? Array.from({ length: room.queueVotes[body.songId] }, (_, i) => `v_${i}`)
            : []);

        const idx = currentVoters.indexOf(voterId);
        if (idx >= 0) {
          currentVoters.splice(idx, 1);
        } else {
          currentVoters.push(voterId);
        }

        room.queueVotes[body.songId] = currentVoters;

        if (room.queue) {
          room.queue.sort((a, b) => getVoteScore(room.queueVotes[b.id]) - getVoteScore(room.queueVotes[a.id]));
        }

        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'QUEUE_UPDATED',
          queue: room.queue,
          votes: room.queueVotes,
          version: room.version
        };

        notifyRoomListeners(room);
        await syncRoomToCloud(room);
        return NextResponse.json({ success: true, votes: room.queueVotes, queue: room.queue });
      }
    }

    // 11. CHAT MESSAGE IN ROOM (Real-time broadcast & cloud persistent)
    if (action === 'chat') {
      if (body.message) {
        if (!room.chats) room.chats = [];
        const chatItem = {
          id: String(Date.now()) + '_' + Math.random().toString(36).substring(2, 6),
          sender: user.username || body.username || 'Listener',
          message: body.message,
          timestamp: getISTTimestamp()
        };
        room.chats.push(chatItem);
        if (room.chats.length > 50) room.chats.shift();

        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'CHAT',
          chat: chatItem,
          chats: room.chats,
          version: room.version
        };

        notifyRoomListeners(room);
        await syncRoomToCloud(room);
        return NextResponse.json({ success: true, chat: chatItem, chats: room.chats });
      }
    }

    // 12. LEAVE ROOM
    if (action === 'leave') {
      const currentUserId = String(user.id).toLowerCase();
      const currentUserName = String(user.username || '').toLowerCase();
      const leavingMember = (room.members || []).find(
        (m) => String(m.id).toLowerCase() === currentUserId || String(m.username).toLowerCase() === currentUserName
      );

      room.members = (room.members || []).filter(
        (m) => String(m.id).toLowerCase() !== currentUserId && String(m.username).toLowerCase() !== currentUserName
      );

      if (room.members.length === 0) {
        delete roomsStore[code];
      } else {
        if (!room.chats) room.chats = [];
        const leaveChat = {
          id: `sys_leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sender: 'System',
          isSystem: true,
          message: `🚪 ${leavingMember?.username || user.username || 'A listener'} left the room`,
          timestamp: getISTTimestamp()
        };
        room.chats.push(leaveChat);
        if (room.chats.length > 50) room.chats.shift();

        room.version = (room.version || 0) + 1;
        room.lastEvent = {
          type: 'MEMBER_LEFT',
          userId: user.id,
          username: user.username,
          members: room.members,
          chat: leaveChat,
          version: room.version
        };
        notifyRoomListeners(room);
      }

      await syncRoomToCloud(room);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, room: getSanitizedRoom(room) });
  } catch (err) {
    console.error("Room API Error:", err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
