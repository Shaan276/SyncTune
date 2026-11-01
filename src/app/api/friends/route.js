import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLOUD_FRIENDS_BIN = 'https://extendsclass.com/api/json-storage/bin/ddaeeaf';
const CLOUD_USERS_BIN = 'https://extendsclass.com/api/json-storage/bin/fccfdcb';
const CLOUD_ROOMS_BIN = 'https://extendsclass.com/api/json-storage/bin/fdddbaf';

if (!global._synctune_friends_cache) {
  global._synctune_friends_cache = {
    data: null,
    lastFetched: 0
  };
}

if (!global._synctune_user_heartbeats) {
  global._synctune_user_heartbeats = {};
}

async function getFriendsData(forceFresh = false) {
  const cache = global._synctune_friends_cache;
  const now = Date.now();
  if (!forceFresh && cache.data && (now - cache.lastFetched < 3000)) {
    return cache.data;
  }

  try {
    const res = await fetch(`${CLOUD_FRIENDS_BIN}?_t=${now}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      cache.data = {
        friendships: Array.isArray(data.friendships) ? data.friendships : [],
        friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : []
      };
      cache.lastFetched = now;
      return cache.data;
    }
  } catch (e) {
    console.warn('Friends cloud fetch deferred:', e.message);
  }

  return cache.data || { friendships: [], friendRequests: [] };
}

async function saveFriendsData(data) {
  const cache = global._synctune_friends_cache;
  cache.data = data;
  cache.lastFetched = Date.now();

  try {
    await fetch(CLOUD_FRIENDS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn('Friends cloud save deferred:', e.message);
  }
  return true;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const reqUsername = (searchParams.get('username') || '').trim().toLowerCase();
  const reqEmail = (searchParams.get('email') || '').trim().toLowerCase();

  if (!userId) {
    return NextResponse.json({ success: true, friends: [], requests: [] });
  }

  // Record requester presence / heartbeat
  const now = Date.now();
  const normalizedId = String(userId).toLowerCase();
  global._synctune_user_heartbeats[normalizedId] = now;
  if (reqUsername) global._synctune_user_heartbeats[reqUsername] = now;
  if (reqEmail) global._synctune_user_heartbeats[reqEmail] = now;

  const { friendships, friendRequests } = await getFriendsData(true);

  // Find all friends connected to this user (matches user1 or user2 by id or email)
  const userFriendIds = friendships
    .filter((f) => String(f.user1).toLowerCase() === normalizedId || String(f.user2).toLowerCase() === normalizedId)
    .map((f) => (String(f.user1).toLowerCase() === normalizedId ? f.user2 : f.user1));

  // Incoming friend requests for this user
  const incoming = friendRequests.filter((r) => String(r.toUserId).toLowerCase() === normalizedId && r.status === 'pending');

  // Load user details from cloud users
  let allUsers = [];
  try {
    const uRes = await fetch(`${CLOUD_USERS_BIN}?_t=${now}`, { cache: 'no-store' });
    if (uRes.ok) {
      const uData = await uRes.json();
      allUsers = uData.users || [];
    }
  } catch (e) {}

  // Active rooms from cloud multi-device store + in-memory store
  let activeRooms = { ...(global._synctune_rooms || {}) };
  try {
    const rRes = await fetch(`${CLOUD_ROOMS_BIN}?_t=${now}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (rRes.ok) {
      const rData = await rRes.json();
      if (rData && typeof rData.rooms === 'object' && rData.rooms) {
        activeRooms = { ...activeRooms, ...rData.rooms };
      }
    }
  } catch (e) {}

  const heartbeats = global._synctune_user_heartbeats || {};

  const friendList = userFriendIds.map((fId) => {
    const targetKey = String(fId).toLowerCase();
    const u = allUsers.find(
      (x) =>
        String(x.id).toLowerCase() === targetKey ||
        (x.email && x.email.toLowerCase() === targetKey) ||
        (x.username && x.username.toLowerCase() === targetKey)
    ) || {
      id: fId,
      username: 'Friend',
      email: ''
    };

    // Check if this friend is active in any room
    let activeRoomCode = null;
    let roomSong = null;
    let isPlaying = false;

    for (const [code, room] of Object.entries(activeRooms)) {
      if (!room) continue;
      const members = Array.isArray(room.members) ? room.members : [];
      const isMember = members.some(
        (m) =>
          String(m.id).toLowerCase() === targetKey ||
          (m.username && m.username.toLowerCase() === (u.username || '').toLowerCase()) ||
          (m.email && m.email.toLowerCase() === (u.email || '').toLowerCase())
      );
      const isHost =
        String(room.host_id).toLowerCase() === targetKey ||
        (room.host_name && room.host_name.toLowerCase() === (u.username || '').toLowerCase());

      if (isMember || isHost) {
        activeRoomCode = room.code || code;
        roomSong = room.currentSong || null;
        isPlaying = Boolean(room.isPlaying);
        break;
      }
    }

    const friendHb =
      heartbeats[targetKey] ||
      (u.email ? heartbeats[u.email.toLowerCase()] : 0) ||
      (u.username ? heartbeats[u.username.toLowerCase()] : 0);
    const isHeartbeatActive = Boolean(friendHb && now - friendHb < 60000);
    const isOnline = Boolean(activeRoomCode) || isHeartbeatActive || Boolean(u.lastSeen && now - u.lastSeen < 180000);
    const status = activeRoomCode ? (isPlaying ? 'listening' : 'in_room') : (isOnline ? 'active' : 'offline');

    return {
      id: u.id || fId,
      name: u.username || 'Friend',
      email: u.email || '',
      is_online: isOnline,
      status: status,
      active_room: activeRoomCode,
      currentSong: roomSong
    };
  });

  return NextResponse.json({
    success: true,
    friends: friendList,
    requests: incoming
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || 'add').toLowerCase();
    const currentUserId = body.userId;
    const currentUser = body.user || { id: currentUserId, username: 'Listener' };

    if (!currentUserId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const data = await getFriendsData(true);

    // 1. Send Friend Request / Connect Directly
    if (action === 'send_request') {
      const targetQuery = (body.query || '').trim().toLowerCase();
      if (!targetQuery) {
        return NextResponse.json({ success: false, error: 'Please enter a username or email.' }, { status: 400 });
      }

      // Find target user from cloud users
      let allUsers = [];
      try {
        const uRes = await fetch(`${CLOUD_USERS_BIN}?_t=${Date.now()}`, { cache: 'no-store' });
        if (uRes.ok) {
          const uData = await uRes.json();
          allUsers = uData.users || [];
        }
      } catch (e) {}

      const currentKey = String(currentUserId).toLowerCase();
      const target = allUsers.find((u) => {
        const matchName = u.username && u.username.toLowerCase() === targetQuery;
        const matchEmail = u.email && u.email.toLowerCase() === targetQuery;
        const isNotSelf = String(u.id).toLowerCase() !== currentKey && (u.email ? u.email.toLowerCase() !== currentKey : true);
        return (matchName || matchEmail) && isNotSelf;
      });

      if (!target) {
        return NextResponse.json({
          success: false,
          error: 'No SyncTune account found with that username or email.'
        }, { status: 404 });
      }

      // Check if already friends
      const isAlreadyFriend = data.friendships.some((f) => {
        const u1 = String(f.user1).toLowerCase();
        const u2 = String(f.user2).toLowerCase();
        const me = currentKey;
        const themId = String(target.id).toLowerCase();
        const themEmail = (target.email || '').toLowerCase();
        return (
          (u1 === me && (u2 === themId || u2 === themEmail)) ||
          (u2 === me && (u1 === themId || u1 === themEmail))
        );
      });

      if (isAlreadyFriend) {
        return NextResponse.json({ success: false, error: 'You are already connected as friends.' }, { status: 400 });
      }

      // Add friendship directly
      data.friendships.push({
        id: `f_${Date.now()}`,
        user1: currentUserId,
        user2: target.id,
        createdAt: new Date().toISOString()
      });

      await saveFriendsData(data);

      return NextResponse.json({
        success: true,
        message: `Connected with ${target.username} successfully!`,
        friend: {
          id: target.id,
          name: target.username,
          email: target.email,
          is_online: true,
          status: 'active',
          active_room: null
        }
      });
    }

    // 2. Remove Friend
    if (action === 'remove_friend') {
      const friendId = String(body.friendId).toLowerCase();
      const currentKey = String(currentUserId).toLowerCase();
      data.friendships = data.friendships.filter((f) => {
        const u1 = String(f.user1).toLowerCase();
        const u2 = String(f.user2).toLowerCase();
        const match =
          (u1 === currentKey && u2 === friendId) ||
          (u2 === currentKey && u1 === friendId);
        return !match;
      });
      await saveFriendsData(data);
      return NextResponse.json({ success: true, message: 'Friend removed.' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    console.error('Friends API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
