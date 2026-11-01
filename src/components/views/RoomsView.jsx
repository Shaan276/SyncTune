'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Radio, Plus, MessageSquare, ThumbsUp, Users, Play, LogOut, Search, Sparkles, Zap, ArrowRight, Copy, Check, Lock, Crown, Shield, Music2, RefreshCw } from 'lucide-react';
import { searchYouTube, fetchLiveRecommendations, getUserRecommendations, formatTime } from '../../lib/youtube';

export function getISTTimestamp() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date());
}

export function getCleanVoteCount(votesData) {
  if (Array.isArray(votesData)) return votesData.length;
  if (typeof votesData === 'number') return votesData;
  if (typeof votesData === 'string') {
    if (/^\d+$/.test(votesData)) {
      const parsed = parseInt(votesData, 10);
      return parsed > 100000 ? 1 : parsed;
    }
    return 1;
  }
  return votesData ? 1 : 0;
}

// Curated high-energy predefined queue so the room is never empty
const DEFAULT_ROOM_QUEUE = [
  {
    id: '7wtfhZwyrcc',
    title: 'Believer',
    artist: 'Imagine Dragons',
    thumbnail: 'https://img.youtube.com/vi/7wtfhZwyrcc/mqdefault.jpg',
    duration: 204
  },
  {
    id: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    thumbnail: 'https://img.youtube.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
    duration: 200
  },
  {
    id: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
    duration: 359
  },
  {
    id: 'JGwWNGJdvx8',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg',
    duration: 233
  },
  {
    id: 'TUVcZfQe-Kw',
    title: 'Levitating',
    artist: 'Dua Lipa',
    thumbnail: 'https://img.youtube.com/vi/TUVcZfQe-Kw/mqdefault.jpg',
    duration: 203
  },
  {
    id: 'H5v3kku4y6Q',
    title: 'As It Was',
    artist: 'Harry Styles',
    thumbnail: 'https://img.youtube.com/vi/H5v3kku4y6Q/mqdefault.jpg',
    duration: 167
  },
  {
    id: 'kTJczUoc268',
    title: 'Stay',
    artist: 'The Kid LAROI & Justin Bieber',
    thumbnail: 'https://img.youtube.com/vi/kTJczUoc268/mqdefault.jpg',
    duration: 141
  },
  {
    id: 'hT_nvWreIhg',
    title: 'One Love',
    artist: 'Shubh',
    thumbnail: 'https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg',
    duration: 160
  },
  {
    id: 'syFZfO_wfMQ',
    title: 'Night Changes',
    artist: 'One Direction',
    thumbnail: 'https://img.youtube.com/vi/syFZfO_wfMQ/mqdefault.jpg',
    duration: 220
  },
  {
    id: 'A66TYFbgYAM',
    title: 'Softly',
    artist: 'Karan Aujla',
    thumbnail: 'https://img.youtube.com/vi/A66TYFbgYAM/mqdefault.jpg',
    duration: 154
  }
];

function getStableUser(user) {
  if (user && user.id) return user;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('synctune_guest_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    const newGuest = {
      id: 'guest_' + Math.random().toString(36).substring(2, 9),
      username: 'Listener_' + Math.floor(100 + Math.random() * 900)
    };
    try {
      localStorage.setItem('synctune_guest_user', JSON.stringify(newGuest));
    } catch (e) {}
    return newGuest;
  }
  return { id: 'guest_listener', username: 'Listener' };
}

export default function RoomsView({
  user,
  activeRoom,
  setActiveRoom,
  currentSong,
  onPlaySong,
  activeRoomMeta
}) {
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [allowListenerControl, setAllowListenerControl] = useState(false); // false = Host Only, true = Collaborative
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [chatMsg, setChatMsg] = useState('');
  const [chats, setChats] = useState([]);
  const [queueVotes, setQueueVotes] = useState({});
  const [roomRecommendations, setRoomRecommendations] = useState(DEFAULT_ROOM_QUEUE);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [roomHost, setRoomHost] = useState('');
  const [roomHostId, setRoomHostId] = useState(null);
  const [roomAllowListenerControl, setRoomAllowListenerControl] = useState(false);

  const roomSearchInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  const [currentUser, setCurrentUser] = useState({ id: 'guest_listener', username: 'Listener' });

  useEffect(() => {
    setCurrentUser(getStableUser(user));
  }, [user]);

  const isHost = activeRoom && (String(roomHostId) === String(currentUser.id) || members.some((m) => String(m.id) === String(currentUser.id) && m.isHost));
  const canControlMusic = !activeRoom || roomAllowListenerControl || isHost;

  // Auto-scroll chat to latest message (scoped to chat container only, never scrolls the outer room page)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats.length]);

  // Real-Time Cross-Window / Cross-Tab Room Events (Chats, Reactions, Upvotes, Queue)
  useEffect(() => {
    if (typeof window === 'undefined' || !activeRoom) return;

    let ch = null;
    try {
      ch = new BroadcastChannel('synctune_room_events_' + activeRoom);
      ch.onmessage = (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;

        if (msg.type === 'CHAT' && msg.chat) {
          setChats((prev) => {
            if (prev.some((c) => String(c.id) === String(msg.chat.id))) return prev;
            return [...prev, msg.chat];
          });
        } else if (msg.type === 'REACTION' && msg.emoji) {
          triggerLocalReaction(msg.emoji, msg.senderName || 'Listener');
        } else if (msg.type === 'UPVOTE' && msg.songId) {
          const voter = msg.voterId;
          setQueueVotes((prev) => {
            const currentList = Array.isArray(prev[msg.songId])
              ? [...prev[msg.songId]]
              : (typeof prev[msg.songId] === 'number' && prev[msg.songId] > 0
                ? Array.from({ length: prev[msg.songId] }, (_, i) => `v_${i}`)
                : []);
            if (voter) {
              const idx = currentList.indexOf(voter);
              if (idx >= 0) {
                currentList.splice(idx, 1);
              } else {
                currentList.push(voter);
              }
            } else {
              currentList.push('anon_' + Date.now());
            }
            return {
              ...prev,
              [msg.songId]: currentList
            };
          });
        } else if (msg.type === 'ADD_QUEUE' && msg.song) {
          setRoomRecommendations((prev) => {
            if (prev.some((s) => s.id === msg.song.id)) return prev;
            return [msg.song, ...prev];
          });
        }
      };
    } catch (e) {}

    return () => {
      try {
        ch?.close();
      } catch (e) {}
    };
  }, [activeRoom]);

  // 1. Fetch and Sync Active Room State
  const syncRoomState = useCallback(async (codeToSync) => {
    const code = codeToSync || activeRoomRef.current;
    if (!code) return;

    try {
      const res = await fetch(`/api/room?action=get&code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setMembers(data.members || []);
          setRoomHost(data.room.host_name || '');
          setRoomHostId(data.room.host_id);
          setRoomAllowListenerControl(data.room.allowListenerControl !== false);

          if (data.chats && Array.isArray(data.chats)) {
            setChats((prev) => {
              const remoteIds = new Set(data.chats.map((c) => String(c.id)));
              const localPending = prev.filter((c) => c.isLocal && !remoteIds.has(String(c.id)));
              return [...data.chats, ...localPending];
            });
          }

          if (data.queueVotes) {
            setQueueVotes((prev) => {
              const prevStr = JSON.stringify(prev || {});
              const newStr = JSON.stringify(data.queueVotes);
              return prevStr === newStr ? prev : data.queueVotes;
            });
          }
          if (data.queue && Array.isArray(data.queue) && data.queue.length > 0) {
            setRoomRecommendations((prev) => {
              const prevIds = (prev || []).map((s) => s.id).join(',');
              const newIds = data.queue.map((s) => s.id).join(',');
              return prevIds === newIds ? prev : data.queue;
            });
          }
        }
      }
    } catch (e) {}
  }, []);

  // Sync real-time updates from parent long-polling ping (Zero polling lag)
  useEffect(() => {
    if (!activeRoomMeta) return;
    if (activeRoomMeta.members && Array.isArray(activeRoomMeta.members)) {
      setMembers(activeRoomMeta.members);
    }
    if (activeRoomMeta.host_name) setRoomHost(activeRoomMeta.host_name);
    if (activeRoomMeta.host_id) setRoomHostId(activeRoomMeta.host_id);
    if (activeRoomMeta.allowListenerControl !== undefined) {
      setRoomAllowListenerControl(activeRoomMeta.allowListenerControl !== false);
    }
    if (activeRoomMeta.chats && Array.isArray(activeRoomMeta.chats)) {
      setChats((prev) => {
        const remoteIds = new Set(activeRoomMeta.chats.map((c) => String(c.id)));
        const localPending = prev.filter((c) => c.isLocal && !remoteIds.has(String(c.id)));
        return [...activeRoomMeta.chats, ...localPending];
      });
    }
    if (activeRoomMeta.queueVotes) {
      setQueueVotes((prev) => {
        const prevStr = JSON.stringify(prev || {});
        const newStr = JSON.stringify(activeRoomMeta.queueVotes);
        return prevStr === newStr ? prev : activeRoomMeta.queueVotes;
      });
    }
    if (activeRoomMeta.queue && Array.isArray(activeRoomMeta.queue)) {
      setRoomRecommendations((prev) => {
        const prevIds = (prev || []).map((s) => s.id).join(',');
        const newIds = activeRoomMeta.queue.map((s) => s.id).join(',');
        return prevIds === newIds ? prev : activeRoomMeta.queue;
      });
    }
  }, [activeRoomMeta]);

  useEffect(() => {
    if (!activeRoom) return;
    syncRoomState(activeRoom);
    const pollTimer = setInterval(() => syncRoomState(activeRoom), 4000);
    return () => clearInterval(pollTimer);
  }, [activeRoom, syncRoomState]);

  // Dynamic Room Recommendations below queue (Refreshed based on Host / Vibe)
  const [roomRecommendationsBelow, setRoomRecommendationsBelow] = useState([]);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);

  const handleRefreshRecommendations = useCallback(async () => {
    setIsRefreshingRecs(true);
    try {
      const seed = currentSong || { artist: 'Ed Sheeran', title: 'Perfect' };
      const res = await fetchLiveRecommendations(seed, true);
      const pool = [...(res.genreTracks || []), ...(res.artistTracks || [])]
        .filter((s) => (s.duration || 210) <= 600);
      if (pool.length > 0) {
        setRoomRecommendationsBelow(pool.sort(() => 0.5 - Math.random()).slice(0, 8));
      } else {
        const personal = getUserRecommendations();
        if (personal && personal.length > 0) {
          setRoomRecommendationsBelow(personal.sort(() => 0.5 - Math.random()).slice(0, 8));
        }
      }
    } catch (e) {
    } finally {
      setIsRefreshingRecs(false);
    }
  }, [currentSong]);

  useEffect(() => {
    handleRefreshRecommendations();
  }, [currentSong?.id]);

  // 2. Create Room Handler (Initialized with Host Personal Recommendations)
  const handleCreateNewRoom = async () => {
    // Stop any currently playing solo song immediately!
    if (typeof window !== 'undefined' && window.syncTunePauseAudio) {
      window.syncTunePauseAudio();
    }
    if (onPlaySong) {
      onPlaySong(null);
    }

    const stableUser = getStableUser(user);
    const generatedCode = 'SYNC' + Math.floor(1000 + Math.random() * 9000);

    // Host personal recommendation queue:
    const hostPersonalRecs = getUserRecommendations();
    const initialQueue = (hostPersonalRecs && hostPersonalRecs.length >= 3)
      ? hostPersonalRecs.slice(0, 10)
      : DEFAULT_ROOM_QUEUE;

    // Instant 0ms transition into room UI
    setActiveRoom(generatedCode);
    setRoomHost(stableUser.username || 'Host');
    setRoomHostId(stableUser.id);
    setRoomAllowListenerControl(allowListenerControl);
    setMembers([{ id: stableUser.id, username: stableUser.username, isHost: true }]);
    setRoomRecommendations(initialQueue);
    setChats([
      {
        id: `sys_create_${Date.now()}`,
        sender: 'System',
        isSystem: true,
        message: `🎉 Room created by ${stableUser.username || 'Host'}`,
        timestamp: getISTTimestamp()
      }
    ]);
    setQueueVotes({});

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          code: generatedCode,
          user: stableUser,
          isPrivate: true,
          allowListenerControl: allowListenerControl,
          queue: initialQueue
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.room) {
        if (data.room.code !== generatedCode) {
          setActiveRoom(data.room.code);
        }
        setRoomHost(data.room.host_name);
        setRoomHostId(data.room.host_id);
        setRoomAllowListenerControl(data.room.allowListenerControl !== false);
        setMembers(data.members || [{ id: stableUser.id, username: stableUser.username, isHost: true }]);
      }
    } catch (err) {
      console.error("Create room error:", err);
    }
  };

  // 3. Join Room Handler (Instant 0ms join without lag)
  const handleJoinRoom = async (codeToJoin) => {
    setJoinError('');
    let rawCode = (codeToJoin || inputCode).toUpperCase().trim().replace(/[\s-]+/g, '');
    if (/^\d{4}$/.test(rawCode)) {
      rawCode = `SYNC${rawCode}`;
    }
    if (!rawCode) return;

    // Immediately unlock audio pipeline synchronously inside user click event (Critical for iOS / Android mobile)
    if (typeof window !== 'undefined' && window.syncTuneUnlockAudio) {
      window.syncTuneUnlockAudio();
    }

    // Stop any currently playing solo song immediately!
    if (typeof window !== 'undefined' && window.syncTunePauseAudio) {
      window.syncTunePauseAudio();
    }
    if (onPlaySong) {
      onPlaySong(null);
    }

    const stableUser = getStableUser(user);

    // Instant 0ms UI transition
    setActiveRoom(rawCode);
    setInputCode('');
    setMembers((prev) => prev.length ? prev : [{ id: stableUser.id, username: stableUser.username }]);
    setRoomRecommendations(DEFAULT_ROOM_QUEUE);

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          code: rawCode,
          user: stableUser
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.room) {
        setRoomHost(data.room.host_name);
        setRoomHostId(data.room.host_id);
        setRoomAllowListenerControl(data.room.allowListenerControl !== false);
        setMembers(data.members || []);

        if (data.chats) setChats(data.chats);
        if (data.queueVotes || data.room.queueVotes) setQueueVotes(data.queueVotes || data.room.queueVotes);
        if ((data.queue && Array.isArray(data.queue)) || (data.room.queue && Array.isArray(data.room.queue))) {
          const incomingQ = data.queue || data.room.queue;
          if (incomingQ.length > 0) setRoomRecommendations(incomingQ);
        }

        // Immediately start listening at the exact room playback position!
        const roomSong = data.room.currentSong || data.currentSong;
        const isPlaying = Boolean(data.room.isPlaying ?? data.isPlaying);
        const accurateTime = Number(data.room.currentTime ?? data.currentTime) || 0;

        if (roomSong && isPlaying && onPlaySong) {
          onPlaySong(roomSong, true, false, accurateTime);
        }
      }
    } catch (err) {
      console.error('Join room error:', err);
    }
  };

  // 4. Room Leave Handler (Immediate optimistic exit & audio stop)
  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    const code = activeRoom;
    const stableUser = getStableUser(user);

    // 1. Immediately detach UI and pause audio optimistically
    setActiveRoom(null);
    setMembers([]);
    setChats([]);
    setQueueVotes({});
    if (typeof window !== 'undefined' && window.syncTunePauseAudio) {
      window.syncTunePauseAudio();
    }

    // 2. Notify server and cloud in background
    try {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          code,
          user: stableUser
        })
      }).catch(() => {});
    } catch (e) {}
  };

  // 4b. Toggle Control Mode (Host Only vs Everyone)
  const handleToggleControlMode = async () => {
    if (!isHost || !activeRoom) return;
    const newAllow = !roomAllowListenerControl;
    setRoomAllowListenerControl(newAllow);
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_control_mode',
          code: activeRoom,
          allowListenerControl: newAllow,
          user: getStableUser(user)
        })
      });
    } catch (e) {}
  };

  // 5. Play song inside room & sync
  const handlePlaySongInRoom = async (song) => {
    if (!song) return;
    if (!canControlMusic) {
      setJoinError('🔒 Only the room host can change or play songs in this room.');
      setTimeout(() => setJoinError(''), 4000);
      return;
    }
    onPlaySong(song);

    if (activeRoom) {
      const stableUser = getStableUser(user);
      try {
        await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'play',
            code: activeRoom,
            song,
            currentTime: 0,
            user: stableUser
          })
        });
      } catch (e) {}
    }
  };

  // 6. Add searched song to room queue (synced to server and BroadcastChannel)
  const handleAddToRoomQueue = async (song) => {
    if (!song || !song.id) return;
    setRoomRecommendations((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) return prev;
      return [...prev, song];
    });
    setRoomSearchResults([]);

    if (activeRoom) {
      try {
        await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_queue',
            code: activeRoom,
            song
          })
        });
      } catch (e) {}
    }

    try {
      const ch = new BroadcastChannel('synctune_room_events_' + activeRoom);
      ch.postMessage({ type: 'ADD_QUEUE', song });
      ch.close();
    } catch (e) {}
  };

  // 7. Dynamic recommendations for the room based on currently playing song
  useEffect(() => {
    if (!currentSong) return;
    let active = true;

    fetchLiveRecommendations(currentSong).then((recs) => {
      if (active) {
        const combined = [...(recs.genreTracks || []), ...(recs.artistTracks || [])]
          .filter((s) => (s.duration || 210) <= 600)
          .slice(0, 10);
        if (combined.length > 0) {
          setRoomRecommendations(combined);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [currentSong?.id, currentSong?.artist]);

  // 8. Inside room search (Fast & Responsive with 4s timeout guarantee)
  const handleRoomSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = roomSearchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const searchPromise = searchYouTube(q, 'music');
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([]), 4000));
      const results = await Promise.race([searchPromise, timeoutPromise]);
      setRoomSearchResults((results || []).filter((s) => (s.duration || 210) <= 600).slice(0, 8));
    } catch (err) {
      console.error('Room search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 9. Chat send (Optimistic UI, persistent across polling & 0ms cross-tab broadcast)
  const handleSendChat = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const msg = chatMsg.trim();
    if (!msg || !activeRoom) return;

    const stableUser = getStableUser(user);
    const tempId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const chatItem = {
      id: tempId,
      sender: stableUser.username || 'Listener',
      message: msg,
      timestamp: getISTTimestamp(),
      isLocal: true
    };

    setChats((prev) => [...prev, chatItem]);
    setChatMsg('');

    // Cross-tab broadcast
    try {
      const ch = new BroadcastChannel('synctune_room_events_' + activeRoom);
      ch.postMessage({ type: 'CHAT', chat: chatItem });
      ch.close();
    } catch (e) {}

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          code: activeRoom,
          user: stableUser,
          message: msg
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.chat) {
          setChats((prev) =>
            prev.map((c) => (c.id === tempId ? { ...data.chat, isLocal: false } : c))
          );
        }
      }
    } catch (err) {
      console.error('Send chat error:', err);
    }
  };

  const triggerLocalReaction = (emoji, senderName) => {
    const reactionId = Date.now() + Math.random();
    setFloatingReactions((prev) => [...prev, { id: reactionId, emoji, senderName }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 2500);
  };

  const handleSendReaction = (emoji) => {
    if (!activeRoom) return;
    const stableUser = getStableUser(user);
    triggerLocalReaction(emoji, stableUser.username);

    try {
      const ch = new BroadcastChannel('synctune_room_events_' + activeRoom);
      ch.postMessage({ type: 'REACTION', emoji, senderName: stableUser.username });
      ch.close();
    } catch (e) {}
  };

  const handleUpvote = async (song) => {
    if (!activeRoom || !song?.id) return;
    const songId = song.id;
    const stableUser = getStableUser(user);
    const voterId = String(stableUser.id || stableUser.email || stableUser.username || 'user');

    // Optimistically toggle / add vote
    setQueueVotes((prev) => {
      const currentList = Array.isArray(prev[songId])
        ? [...prev[songId]]
        : (typeof prev[songId] === 'number' && prev[songId] > 0
          ? Array.from({ length: prev[songId] }, (_, i) => `v_${i}`)
          : []);
      const idx = currentList.indexOf(voterId);
      if (idx >= 0) {
        currentList.splice(idx, 1);
      } else {
        currentList.push(voterId);
      }
      return {
        ...prev,
        [songId]: currentList
      };
    });

    try {
      const ch = new BroadcastChannel('synctune_room_events_' + activeRoom);
      ch.postMessage({ type: 'UPVOTE', songId, voterId });
      ch.close();
    } catch (e) {}

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upvote',
          code: activeRoom,
          songId,
          user: stableUser
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.votes) {
          setQueueVotes((prev) => {
            const prevStr = JSON.stringify(prev || {});
            const newStr = JSON.stringify(data.votes);
            return prevStr === newStr ? prev : data.votes;
          });
        }
        if (data.queue && Array.isArray(data.queue)) {
          setRoomRecommendations((prev) => {
            const prevIds = (prev || []).map((s) => s.id).join(',');
            const newIds = data.queue.map((s) => s.id).join(',');
            return prevIds === newIds ? prev : data.queue;
          });
        }
      }
    } catch (e) {}
  };

  const handleCopyCode = () => {
    if (activeRoom) {
      navigator.clipboard?.writeText(activeRoom);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Queue is dynamically sorted by collective votes, memoized to prevent re-rendering/flickering
  const sortedRecommendations = useMemo(() => {
    const activeQueueList = roomRecommendations && roomRecommendations.length > 0 ? roomRecommendations : DEFAULT_ROOM_QUEUE;
    return [...activeQueueList].sort((a, b) => {
      const votesA = getCleanVoteCount(queueVotes[a.id]);
      const votesB = getCleanVoteCount(queueVotes[b.id]);
      return votesB - votesA;
    });
  }, [roomRecommendations, queueVotes]);

  return (
    <div className="flex flex-col gap-6 pb-28 relative">
      {/* Floating Reactions Overlay */}
      {floatingReactions.length > 0 && (
        <div className="fixed bottom-28 right-8 z-50 pointer-events-none flex flex-col gap-2">
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              className="animate-bounce flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/90 border border-emerald-500/40 text-sm shadow-xl"
            >
              <span className="text-xl">{r.emoji}</span>
              <span className="text-[10px] font-bold text-white">{r.senderName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Header Controls Bar */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-black text-white tracking-wide truncate">Private Synchronous Rooms</h2>
            <p className="text-xs text-zinc-400 truncate">Listen together with friends in 100% sync</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {!activeRoom ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Listener Control Permission Selector */}
              <div className="flex p-0.5 rounded-xl bg-[#080C14] border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setAllowListenerControl(false)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    !allowListenerControl
                      ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Only Host can play, pause, and manage music"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Host Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAllowListenerControl(true)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    allowListenerControl
                      ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Everyone in the room can play, pause, and manage music"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Everyone</span>
                </button>
              </div>

              {/* Instant + Create New Room Button */}
              <button
                onClick={handleCreateNewRoom}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ CREATE ROOM</span>
              </button>

              {/* Join Existing Room Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputCode.trim()) handleJoinRoom(inputCode.trim());
                }}
                className="flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  placeholder="SYNC1962 / Code..."
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setJoinError('');
                  }}
                  className="px-3 py-2 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white uppercase outline-none focus:border-emerald-500/50 w-28 sm:w-36"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#141C30] hover:bg-[#1a2540] border border-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Join
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyCode}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy Room Code to Share"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : `Code: ${activeRoom}`}</span>
              </button>

              <button
                onClick={handleLeaveRoom}
                className="px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {joinError && (
        <div className="p-3 px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold">
          {joinError}
        </div>
      )}

      {/* Active Room Workspace */}
      {activeRoom ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Main Column */}
            <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-6 min-w-0">
              {/* Room Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs font-mono border border-emerald-500/30 shrink-0">
                    {activeRoom}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white truncate">Room {activeRoom}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleControlMode}
                        disabled={!isHost}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                          isHost ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                        } ${
                          roomAllowListenerControl
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                        title={isHost ? 'Click to toggle Host Only vs Everyone Controls' : (roomAllowListenerControl ? 'Collaborative: Everyone can control music' : 'Host Only: Only host can control music')}
                      >
                        {roomAllowListenerControl ? <Users className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                        <span>{roomAllowListenerControl ? 'Everyone Controls' : 'Host Controls Only'}</span>
                        {isHost && <span className="text-[9px] opacity-70 underline ml-0.5">(change)</span>}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      Host: <strong className="text-white">{roomHost || currentUser.username || 'Host'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live Synchronized</span>
                </div>
              </div>

              {/* Inside-Room Track Fast Search Bar */}
              <form onSubmit={handleRoomSearch} className="flex flex-col gap-2">
                <div
                  onClick={() => roomSearchInputRef.current?.focus()}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#080C14] border border-emerald-500/30 hover:border-emerald-500/60 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all cursor-text"
                >
                  <Search className="w-4 h-4 text-emerald-400 shrink-0 pointer-events-none" />
                  <input
                    ref={roomSearchInputRef}
                    type="text"
                    placeholder="Search any song to sync across room members..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-zinc-500 min-w-0 cursor-text py-0.5"
                  />
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0">
                      <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Searching...</span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                    >
                      Search Track
                    </button>
                  )}
                </div>

                {roomSearchResults.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#080C14] border border-emerald-500/30 flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 pb-1 border-b border-white/5">
                      <span>Search Results ({roomSearchResults.length})</span>
                      <button
                        type="button"
                        onClick={() => setRoomSearchResults([])}
                        className="text-zinc-500 hover:text-white cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    {roomSearchResults.map((song) => (
                      <div
                        key={song.id}
                        className="p-2 rounded-lg bg-white/5 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors min-w-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-white truncate">{song.title}</span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {song.artist} • {formatTime(song.duration)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddToRoomQueue(song)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Add to Upcoming Queue"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Queue</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canControlMusic}
                            onClick={() => {
                              handlePlaySongInRoom(song);
                              setRoomSearchResults([]);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                              canControlMusic
                                ? 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer shadow-md shadow-emerald-500/20'
                                : 'bg-white/5 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{canControlMusic ? 'Play' : 'Host Only'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </form>

              {/* Dynamic Upvote Upcoming Queue (Predefined & Interactive) */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Upvote Upcoming Queue</span>
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">Real-Time Sync Queue</span>
                </div>

                <div className="flex flex-col gap-2">
                  {sortedRecommendations.map((song, idx) => {
                    const votesData = queueVotes[song.id];
                    const voteCount = getCleanVoteCount(votesData);
                    const currentVoterId = String(user?.id || user?.email || user?.username || '');
                    const hasUserVoted = Array.isArray(votesData) && currentVoterId && (
                      votesData.some((v) => String(v).toLowerCase() === currentVoterId.toLowerCase()) ||
                      votesData.some((v) => user?.id && String(v) === String(user.id)) ||
                      votesData.some((v) => user?.email && String(v).toLowerCase() === user.email.toLowerCase()) ||
                      votesData.some((v) => user?.username && String(v).toLowerCase() === user.username.toLowerCase())
                    );

                    return (
                      <div
                        key={song.id}
                        className={`p-3 px-4 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-3 transition-all min-w-0 ${
                          idx === 0 && voteCount > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs font-bold font-mono text-emerald-400 w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-white truncate">{song.title}</span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {song.artist} • {formatTime(song.duration)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpvote(song)}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              hasUserVoted || voteCount > 0
                                ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                                : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                            }`}
                            title={hasUserVoted ? 'You upvoted this song (click to remove)' : 'Upvote song'}
                          >
                            <ThumbsUp className={`w-3 h-3 ${hasUserVoted ? 'fill-current' : ''}`} />
                            <span>{voteCount}</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canControlMusic}
                            onClick={() => handlePlaySongInRoom(song)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              canControlMusic
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer'
                                : 'bg-white/5 text-zinc-500 cursor-not-allowed opacity-60'
                            }`}
                            title={canControlMusic ? 'Play in Room' : 'Only host can control music in this room'}
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Room Recommendations (Refreshed based on Host / Vibe) */}
              <div className="flex flex-col gap-3 min-w-0 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Recommended For This Room
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshRecommendations}
                    disabled={isRefreshingRecs}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingRecs ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isRefreshingRecs ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roomRecommendationsBelow.length === 0 ? (
                    <div className="col-span-full py-4 text-center text-xs text-zinc-500">
                      Loading room recommendations...
                    </div>
                  ) : (
                    roomRecommendationsBelow.map((song) => (
                      <div
                        key={song.id}
                        className="p-2.5 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-2.5 hover:border-cyan-500/30 transition-all min-w-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-white truncate">{song.title}</span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {song.artist} • {formatTime(song.duration)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddToRoomQueue(song)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Add to Upcoming Queue"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canControlMusic}
                            onClick={() => handlePlaySongInRoom(song)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              canControlMusic
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer'
                                : 'bg-white/5 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                            title={canControlMusic ? 'Play Now in Room' : 'Host Only'}
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Room Sidebar: Members & Live Chat */}
            <div className="flex flex-col gap-6">
              {/* Members List */}
              <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Room Members ({members.length})</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>

                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {members.map((m) => (
                    <div
                      key={m.id || m.username}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-bold text-white truncate">{m.username}</span>
                        {m.isHost && (
                          <span className="text-[10px] font-black text-amber-400 shrink-0">👑 Host</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">online</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Live Chat */}
              <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-3 h-80 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Room Live Chat</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">{chats.length} messages</span>
                </div>

                <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                  {chats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                      No messages yet. Say hello to everyone!
                    </div>
                  ) : (
                    chats.map((c) => {
                      if (c.isSystem) {
                        return (
                          <div
                            key={c.id || Math.random()}
                            className="py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300"
                          >
                            <span className="font-semibold">{c.message}</span>
                            <span className="text-[10px] text-emerald-500/70 font-mono ml-2 shrink-0">{c.timestamp} (IST)</span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={c.id || Math.random()}
                          className="p-2 rounded-lg bg-white/5 flex flex-col gap-0.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-emerald-400">
                              {c.sender || c.username || 'Listener'}
                            </span>
                            <span className="text-zinc-500 font-mono">{c.timestamp || c.time || ''}</span>
                          </div>
                          <span className="text-white break-words">{c.message}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-white/5">
                  <input
                    type="text"
                    placeholder="Send message..."
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500/50 min-w-0"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs cursor-pointer shrink-0 transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>

              {/* Room Live Emoji Reactions */}
              <div className="p-3.5 rounded-2xl bg-[#0F1626] border border-white/5 flex items-center justify-around gap-1">
                {['🔥', '❤️', '👏', '💃', '🚀', '⚡'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="text-lg p-1.5 rounded-xl hover:bg-white/10 hover:scale-125 transition-all cursor-pointer active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Clean Private Room Lobby */
        <div className="p-8 sm:p-12 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col items-center justify-center text-center gap-6 max-w-2xl mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-black text-white tracking-wide">Join or Create a Private Listening Room</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Rooms in SyncTune are completely private. Share your simple 4-digit code (e.g.{' '}
              <span className="font-mono text-emerald-400 font-bold">SYNC1962</span>) with friends to listen together in perfect sync.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputCode.trim()) handleJoinRoom(inputCode.trim());
              }}
              className="flex items-center gap-2 w-full"
            >
              <input
                type="text"
                placeholder="Enter Code (e.g. SYNC1962)..."
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  setJoinError('');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[#080C14] border border-white/15 text-sm text-white uppercase outline-none focus:border-emerald-400 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-[#141C30] hover:bg-emerald-500 text-white hover:text-black font-extrabold text-xs transition-all cursor-pointer shrink-0"
              >
                Join
              </button>
            </form>
          </div>

          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="h-[1px] bg-white/10 flex-1" />
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">or create new</span>
            <div className="h-[1px] bg-white/10 flex-1" />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            {/* Listener Control Permission Selector */}
            <div className="flex p-0.5 rounded-xl bg-[#080C14] border border-white/10 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setAllowListenerControl(false)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !allowListenerControl
                    ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Only Host can control playback"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Host Only</span>
              </button>
              <button
                type="button"
                onClick={() => setAllowListenerControl(true)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  allowListenerControl
                    ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Everyone can control playback"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Everyone</span>
              </button>
            </div>

            <button
              onClick={handleCreateNewRoom}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Private Room</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
