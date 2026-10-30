import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory global store for App Router serverless runtime - Starts CLEAN (No fake data)
if (!global._synctune_rooms) {
  global._synctune_rooms = {};
}

const roomsStore = global._synctune_rooms;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const code = (searchParams.get('code') || '').toUpperCase();

  if (action === 'list') {
    // Only return PUBLIC rooms in the discovery list (private rooms are hidden)
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
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
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
    const code = (body.code || 'ROOM1').toUpperCase().trim();
    const user = body.user || { id: Date.now(), username: body.username || 'Listener' };
    const isPrivate = Boolean(body.isPrivate);

    // 1. Create or Join Room
    if (action === 'join' || action === 'create') {
      if (!roomsStore[code]) {
        // Create new room dynamically
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
      } else {
        // Joining existing room
        const room = roomsStore[code];
        const existingMember = room.members.find((m) => m.id === user.id);
        if (!existingMember) {
          room.members.push({
            id: user.id,
            username: user.username,
            isHost: false,
            isOnline: true
          });
        }
      }

      return NextResponse.json({
        success: true,
        room: roomsStore[code],
        members: roomsStore[code].members
      });
    }

    // 2. Play Song in Room
    if (action === 'play') {
      const room = roomsStore[code];
      if (room && body.song) {
        room.currentSong = body.song;
        room.isPlaying = true;
        room.currentTime = body.currentTime || 0;
        room.lastUpdated = Date.now();
        return NextResponse.json({ success: true, room });
      }
    }

    // 3. Pause / Resume Playback in Room
    if (action === 'pause' || action === 'resume') {
      const room = roomsStore[code];
      if (room) {
        room.isPlaying = action === 'resume';
        room.currentTime = body.currentTime || room.currentTime;
        room.lastUpdated = Date.now();
        return NextResponse.json({ success: true, room });
      }
    }

    // 4. Seek Audio / Video in Room
    if (action === 'seek') {
      const room = roomsStore[code];
      if (room) {
        room.currentTime = body.currentTime || 0;
        room.lastUpdated = Date.now();
        return NextResponse.json({ success: true, room });
      }
    }

    // 5. Chat message
    if (action === 'chat') {
      const room = roomsStore[code];
      if (room && body.message) {
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

    // 6. Upvote queue track
    if (action === 'upvote') {
      const room = roomsStore[code];
      if (room && body.songId) {
        room.queueVotes[body.songId] = (room.queueVotes[body.songId] || 0) + 1;
        return NextResponse.json({ success: true, votes: room.queueVotes });
      }
    }

    // 7. Leave room
    if (action === 'leave') {
      const room = roomsStore[code];
      if (room) {
        room.members = room.members.filter((m) => m.id !== user.id);
        if (room.members.length === 0) {
          delete roomsStore[code];
        }
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ success: true, room: roomsStore[code] });
  } catch (err) {
    console.error("Room API Error:", err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
