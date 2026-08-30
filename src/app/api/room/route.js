import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory global store for App Router serverless runtime
if (!global._synctune_rooms) {
  global._synctune_rooms = {
    BEAT1: {
      code: 'BEAT1',
      host_name: 'Piyush',
      host_id: 1,
      members: [
        { id: 1, username: 'Piyush', isHost: true, isOnline: true }
      ],
      currentSong: {
        id: 'hT_nvWreIhg',
        title: 'One Love',
        artist: 'Shubh',
        thumbnail: 'https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg',
        duration: 160
      },
      isPlaying: true,
      currentTime: 0,
      lastUpdated: Date.now(),
      chats: [],
      queueVotes: {}
    },
    CHILL: {
      code: 'CHILL',
      host_name: 'Alex',
      host_id: 2,
      members: [
        { id: 2, username: 'Alex', isHost: true, isOnline: true }
      ],
      currentSong: {
        id: 'A66TYFbgYAM',
        title: 'Softly',
        artist: 'Karan Aujla',
        thumbnail: 'https://img.youtube.com/vi/A66TYFbgYAM/mqdefault.jpg',
        duration: 154
      },
      isPlaying: true,
      currentTime: 0,
      lastUpdated: Date.now(),
      chats: [],
      queueVotes: {}
    }
  };
}

const roomsStore = global._synctune_rooms;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const code = (searchParams.get('code') || '').toUpperCase();

  if (action === 'list') {
    const list = Object.values(roomsStore).map((r) => ({
      code: r.code,
      host_name: r.host_name,
      member_count: (r.members || []).length,
      song_title: r.currentSong?.title || 'No song playing',
      song_artist: r.currentSong?.artist || 'SyncTune',
      is_playing: r.isPlaying ? 1 : 0
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
      queueVotes: room.queueVotes || {}
    });
  }

  return NextResponse.json({ success: true, rooms: Object.values(roomsStore) });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'join';
    const code = (body.code || 'ROOM1').toUpperCase().trim();
    const user = body.user || { id: Date.now(), username: body.username || 'Listener' };

    // 1. Create or Join Room
    if (action === 'join' || action === 'create') {
      if (!roomsStore[code]) {
        // Create new room
        roomsStore[code] = {
          code,
          host_name: user.username,
          host_id: user.id,
          members: [
            { id: user.id, username: user.username, isHost: true, isOnline: true }
          ],
          currentSong: body.currentSong || {
            id: 'hT_nvWreIhg',
            title: 'One Love',
            artist: 'Shubh',
            thumbnail: 'https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg',
            duration: 160
          },
          isPlaying: true,
          currentTime: 0,
          lastUpdated: Date.now(),
          chats: [],
          queueVotes: {}
        };
      } else {
        // Join existing room
        const room = roomsStore[code];
        if (!room.members.some((m) => m.id === user.id || m.username === user.username)) {
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
        code,
        room: roomsStore[code]
      });
    }

    // 2. Update Room Playback State (Song change, Play/Pause, Seek)
    if (action === 'update_playback' && code && roomsStore[code]) {
      const room = roomsStore[code];
      if (body.currentSong) room.currentSong = body.currentSong;
      if (typeof body.isPlaying === 'boolean') room.isPlaying = body.isPlaying;
      if (typeof body.currentTime === 'number') room.currentTime = body.currentTime;
      room.lastUpdated = Date.now();

      return NextResponse.json({
        success: true,
        room
      });
    }

    // 3. Send Chat in Room
    if (action === 'chat' && code && roomsStore[code]) {
      const room = roomsStore[code];
      const newChat = {
        id: Date.now() + Math.random(),
        username: user.username,
        message: body.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      room.chats.push(newChat);
      if (room.chats.length > 50) room.chats = room.chats.slice(-50);

      return NextResponse.json({
        success: true,
        chat: newChat,
        chats: room.chats
      });
    }

    // 4. Upvote Song in Room
    if (action === 'upvote' && code && roomsStore[code]) {
      const room = roomsStore[code];
      const songId = body.songId;
      if (songId) {
        room.queueVotes[songId] = (room.queueVotes[songId] || 0) + 1;
      }
      return NextResponse.json({
        success: true,
        queueVotes: room.queueVotes
      });
    }

    // 5. Leave Room
    if (action === 'leave' && code && roomsStore[code]) {
      const room = roomsStore[code];
      room.members = room.members.filter((m) => m.id !== user.id && m.username !== user.username);
      return NextResponse.json({
        success: true
      });
    }

    return NextResponse.json({ success: true, room: roomsStore[code] });
  } catch (e) {
    console.error('Room API error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
