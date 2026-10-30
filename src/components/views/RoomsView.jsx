'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Plus, MessageSquare, ThumbsUp, Users, Play, LogOut, Search, Sparkles, Zap, ArrowRight, Copy, Check, Lock, Globe } from 'lucide-react';
import { searchYouTube, fetchLiveRecommendations, formatTime } from '../../lib/youtube';

export default function RoomsView({
  user,
  activeRoom,
  setActiveRoom,
  currentSong,
  onPlaySong
}) {
  const [rooms, setRooms] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [chatMsg, setChatMsg] = useState('');
  const [chats, setChats] = useState([]);
  const [queueVotes, setQueueVotes] = useState({});
  const [roomRecommendations, setRoomRecommendations] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [roomHost, setRoomHost] = useState('');
  const [roomIsPrivate, setRoomIsPrivate] = useState(false);

  const roomSearchInputRef = useRef(null);
  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  // 1. Fetch public active rooms from API
  const fetchActiveRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/room?action=list');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchActiveRooms();
    const interval = setInterval(fetchActiveRooms, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveRooms]);

  // 2. Fetch and Sync Active Room State
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
          setRoomIsPrivate(Boolean(data.room.isPrivate));
          if (data.chats) setChats(data.chats);
          if (data.queueVotes) setQueueVotes(data.queueVotes);

          // If a song is actively playing in the room and differs from local
          if (data.currentSong && data.currentSong.id && (!currentSong || currentSong.id !== data.currentSong.id)) {
            if (onPlaySong) {
              onPlaySong(data.currentSong);
            }
          }
        }
      }
    } catch (e) {}
  }, [currentSong, onPlaySong]);

  useEffect(() => {
    if (!activeRoom) return;
    syncRoomState(activeRoom);
    const pollTimer = setInterval(() => syncRoomState(activeRoom), 1500);
    return () => clearInterval(pollTimer);
  }, [activeRoom, syncRoomState]);

  // 3. Create Room Handler (Guaranteed unique code & zero duplicates)
  const handleCreateNewRoom = async () => {
    const currentUser = user || { id: Date.now(), username: 'Listener' };
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          user: currentUser,
          isPrivate: isPrivateMode
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.room) {
        setActiveRoom(data.room.code);
        setRoomHost(data.room.host_name);
        setMembers(data.members || [{ id: currentUser.id, username: currentUser.username, isHost: true }]);
        setRoomIsPrivate(isPrivateMode);
        fetchActiveRooms();
      }
    } catch (err) {
      console.error("Create room error:", err);
    }
  };

  // 4. Join Room Handler (Instantly joins without duplicate room creation)
  const handleJoinRoom = async (codeToJoin) => {
    setJoinError('');
    const rawCode = (codeToJoin || inputCode).toUpperCase().trim();
    if (!rawCode) return;

    const currentUser = user || { id: Date.now(), username: 'Listener' };

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          code: rawCode,
          user: currentUser
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.room) {
        setActiveRoom(data.room.code);
        setInputCode('');
        setRoomHost(data.room.host_name);
        setMembers(data.members || []);
        setRoomIsPrivate(Boolean(data.room.isPrivate));

        // Immediately start listening if host is playing a track!
        if (data.currentSong && onPlaySong) {
          onPlaySong(data.currentSong);
        }
      } else {
        setJoinError(data?.error || `Room "${rawCode}" does not exist.`);
      }
    } catch (err) {
      setJoinError('Network error joining room.');
    }
  };

  // 5. Room Leave Handler
  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    const code = activeRoom;
    const currentUser = user || { id: Date.now(), username: 'Listener' };

    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          code,
          user: currentUser
        })
      });
    } catch (e) {}

    setActiveRoom(null);
    setMembers([]);
    setChats([]);
    setQueueVotes({});
    fetchActiveRooms();
  };

  // 6. Play song inside room & sync
  const handlePlaySongInRoom = async (song) => {
    if (!song) return;
    onPlaySong(song);

    if (activeRoom) {
      try {
        await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'play',
            code: activeRoom,
            song,
            currentTime: 0
          })
        });
      } catch (e) {}
    }
  };

  // 7. Dynamic recommendations for the room based on currently playing song
  useEffect(() => {
    if (!currentSong) {
      setRoomRecommendations([]);
      return;
    }
    let active = true;

    fetchLiveRecommendations(currentSong).then((recs) => {
      if (active) {
        const combined = [...(recs.genreTracks || []), ...(recs.artistTracks || [])]
          .filter((s) => (s.duration || 210) <= 600)
          .slice(0, 6);
        setRoomRecommendations(combined);
      }
    });

    return () => {
      active = false;
    };
  }, [currentSong?.id, currentSong?.artist]);

  // 8. Inside room search
  const handleRoomSearch = async (e) => {
    e.preventDefault();
    if (!roomSearchQuery.trim()) return;

    setIsSearching(true);
    const results = await searchYouTube(roomSearchQuery.trim(), 'music');
    setRoomSearchResults(results.filter((s) => (s.duration || 210) <= 600).slice(0, 6));
    setIsSearching(false);
  };

  // 9. Chat send
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim() || !activeRoom) return;

    const currentUser = user || { username: 'Listener' };
    const chatItem = {
      id: Date.now(),
      sender: currentUser.username,
      message: chatMsg.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats((prev) => [...prev, chatItem]);
    setChatMsg('');

    try {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          code: activeRoom,
          user: currentUser,
          message: chatItem.message
        })
      });
    } catch (err) {}
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
    const currentUser = user || { username: 'Listener' };
    triggerLocalReaction(emoji, currentUser.username);
  };

  const handleUpvote = async (song) => {
    if (!activeRoom) return;
    const songId = song.id;

    setQueueVotes((prev) => ({
      ...prev,
      [songId]: (prev[songId] || 0) + 1
    }));

    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upvote',
          code: activeRoom,
          songId
        })
      });
    } catch (e) {}
  };

  const handleCopyCode = () => {
    if (activeRoom) {
      navigator.clipboard?.writeText(activeRoom);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const sortedRecommendations = [...roomRecommendations].sort((a, b) => {
    const votesA = queueVotes[a.id] || 0;
    const votesB = queueVotes[b.id] || 0;
    return votesB - votesA;
  });

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
            <h2 className="text-base font-black text-white tracking-wide truncate">Synchronous Listening Rooms</h2>
            <p className="text-xs text-zinc-400 truncate">Stream audio with multiple devices in 100% sync</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {!activeRoom ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Public vs Private Selector */}
              <div className="flex p-0.5 rounded-xl bg-[#080C14] border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPrivateMode(false)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    !isPrivateMode
                      ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Visible in discovery list"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivateMode(true)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isPrivateMode
                      ? 'bg-purple-500 text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Unlisted (Join by code only)"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private</span>
                </button>
              </div>

              {/* Instant + Create New Room Button */}
              <button
                onClick={handleCreateNewRoom}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ CREATE {isPrivateMode ? 'PRIVATE' : 'PUBLIC'} ROOM</span>
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
                  placeholder="Room Code..."
                  value={inputCode}
                  onChange={(e) => { setInputCode(e.target.value); setJoinError(''); }}
                  className="px-3 py-2 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white uppercase outline-none focus:border-emerald-500/50 w-28 sm:w-32"
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white truncate">Listening Room {activeRoom}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                        roomIsPrivate ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {roomIsPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        <span>{roomIsPrivate ? 'Private' : 'Public'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">Host: <strong className="text-white">{roomHost || user?.username || 'Host'}</strong></p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live Synchronized</span>
                </div>
              </div>

              {/* Inside-Room Track Search Bar (Full Click-to-Focus Area) */}
              <form onSubmit={handleRoomSearch} className="flex flex-col gap-2">
                <div
                  onClick={() => roomSearchInputRef.current?.focus()}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#080C14] border border-emerald-500/30 hover:border-emerald-500/60 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all cursor-text"
                >
                  <Search className="w-4 h-4 text-emerald-400 shrink-0 pointer-events-none" />
                  <input
                    ref={roomSearchInputRef}
                    type="text"
                    placeholder="Search any song to sync across room members (<10m)..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-zinc-500 min-w-0 cursor-text py-0.5"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                  >
                    {isSearching ? 'Searching...' : 'Search Track'}
                  </button>
                </div>

                {roomSearchResults.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#080C14] border border-emerald-500/30 flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
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
                          <img src={song.thumbnail} alt={song.title} className="w-8 h-8 rounded object-cover shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-white truncate">{song.title}</span>
                            <span className="text-[10px] text-zinc-400 truncate">{song.artist}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handlePlaySongInRoom(song);
                            setRoomSearchResults([]);
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play in Room</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </form>

              {/* Dynamic Upvote Recommendation System */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Upvote Upcoming Queue</span>
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">Real-Time Sync Queue</span>
                </div>

                {sortedRecommendations.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {sortedRecommendations.map((song, idx) => {
                      const votes = queueVotes[song.id] || 0;
                      return (
                        <div
                          key={song.id}
                          className={`p-3 px-4 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-3 transition-all min-w-0 ${
                            idx === 0 && votes > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-xs font-bold font-mono text-emerald-400 w-5 shrink-0">#{idx + 1}</span>
                            <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-white truncate">{song.title}</span>
                              <span className="text-[11px] text-zinc-400 truncate">{song.artist} • {formatTime(song.duration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleUpvote(song)}
                              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                votes > 0
                                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                                  : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{votes}</span>
                            </button>
                            <button
                              onClick={() => handlePlaySongInRoom(song)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                              title="Play in Room"
                            >
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#080C14] border border-white/5 text-center text-xs text-zinc-500 italic">
                    Play a track or search above to load synchronized recommendations for this room.
                  </div>
                )}
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
                    <div key={m.id || m.username} className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs">
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
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Room Live Chat</span>
                </span>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                  {chats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                      No messages yet. Say hello to everyone!
                    </div>
                  ) : (
                    chats.map((c) => (
                      <div key={c.id || Math.random()} className="p-2 rounded-lg bg-white/5 flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-emerald-400">{c.sender}</span>
                          <span className="text-zinc-500 font-mono">{c.timestamp}</span>
                        </div>
                        <span className="text-white break-words">{c.message}</span>
                      </div>
                    ))
                  )}
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-extrabold text-xs cursor-pointer shrink-0"
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
        /* Discovery: Active Public Rooms Directory */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Public Listening Rooms ({rooms.length})</span>
            </h3>
            <span className="text-xs text-zinc-500">Live synchronized streams</span>
          </div>

          {rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.code}
                  className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-black text-xs">
                      {room.code}
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{room.member_count || 1} listeners</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {room.song_title || 'No song playing'}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {room.song_artist || 'SyncTune'} • Host: <strong className="text-zinc-300">{room.host_name}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => handleJoinRoom(room.code)}
                    className="w-full py-2 rounded-xl bg-[#141C30] hover:bg-emerald-500 text-zinc-300 hover:text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Join Room</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 rounded-2xl bg-[#0F1626] border border-white/5 text-center flex flex-col items-center justify-center gap-3">
              <Radio className="w-8 h-8 text-emerald-400 animate-pulse" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-white text-sm">No active public rooms right now</span>
                <span className="text-zinc-500 text-xs">
                  Click "+ CREATE ROOM" above to start a session and invite your friends!
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
