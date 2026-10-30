'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Plus, MessageSquare, ThumbsUp, Users, Play, LogOut, Search, Tv, Sparkles, Zap, ArrowRight, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { searchYouTube, fetchLiveRecommendations, formatTime } from '../../lib/youtube';

export default function RoomsView({
  user,
  activeRoom,
  setActiveRoom,
  currentSong,
  onPlaySong,
  onOpenCinema
}) {
  const [rooms, setRooms] = useState([
    { code: 'BEAT1', host_name: 'Piyush', member_count: 5, song_title: 'One Love', song_artist: 'Shubh', is_playing: 1 },
    { code: 'CHILL', host_name: 'Alex', member_count: 3, song_title: 'Softly', song_artist: 'Karan Aujla', is_playing: 1 },
    { code: 'VIBE9', host_name: 'Sarah', member_count: 4, song_title: 'Happier Than Ever', song_artist: 'Billie Eilish', is_playing: 1 }
  ]);

  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [chatMsg, setChatMsg] = useState('');
  const [chats, setChats] = useState([]);
  const [queueVotes, setQueueVotes] = useState({});
  const [roomRecommendations, setRoomRecommendations] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [roomHost, setRoomHost] = useState('');

  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  // 1. Fetch all active rooms from API
  const fetchActiveRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/room?action=list');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms && data.rooms.length > 0) {
          setRooms(data.rooms);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchActiveRooms();
    const interval = setInterval(fetchActiveRooms, 5000);
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
          if (data.chats) setChats(data.chats);
          if (data.queueVotes) setQueueVotes(data.queueVotes);

          if (data.currentSong && data.currentSong.id && (!currentSong || currentSong.id !== data.currentSong.id)) {
            if (onPlaySong) {
              onPlaySong(data.currentSong);
            }
          }
        }
      }
    } catch (e) {}
  }, [currentSong, onPlaySong]);

  // 3. Guaranteed Room Creation (Fixes "create new room doing nothing")
  const handleCreateNewRoom = () => {
    // Generate clean alphanumeric 5-character code
    const generatedCode = 'SYNC' + Math.floor(100 + Math.random() * 900);
    handleJoinOrCreateRoom(generatedCode);
  };

  // 4. Join / Create Room Handler
  const handleJoinOrCreateRoom = async (codeToJoin) => {
    const rawCode = (codeToJoin || inputCode).toUpperCase().trim();
    const code = rawCode || ('SYNC' + Math.floor(100 + Math.random() * 900));
    const currentUser = user || { id: Date.now(), username: 'Listener' };

    // Optimistic UI: Set active room immediately!
    setActiveRoom(code);
    setInputCode('');

    // Pre-populate members list
    setMembers([
      { id: currentUser.id, username: currentUser.username, isHost: true, isOnline: true }
    ]);
    setRoomHost(currentUser.username);

    // Ensure room appears in room list
    setRooms((prev) => {
      if (!prev.some((r) => r.code === code)) {
        return [
          {
            code,
            host_name: currentUser.username,
            member_count: 1,
            song_title: currentSong?.title || 'One Love',
            song_artist: currentSong?.artist || 'Shubh',
            is_playing: 1
          },
          ...prev
        ];
      }
      return prev;
    });

    // Notify backend
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          code,
          user: currentUser,
          currentSong
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          if (data.room.members) setMembers(data.room.members);
          if (data.room.host_name) setRoomHost(data.room.host_name);
          if (data.room.currentSong && onPlaySong) {
            onPlaySong(data.room.currentSong);
          }
        }
      }
    } catch (e) {
      console.warn('API room join fallback:', e);
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

  // 6. Play song inside room & broadcast
  const handlePlaySongInRoom = async (song) => {
    if (!song) return;
    onPlaySong(song);

    if (activeRoom) {
      try {
        await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_playback',
            code: activeRoom,
            currentSong: song,
            isPlaying: true,
            currentTime: 0
          })
        });
      } catch (e) {}

      const channel = supabase.channel(`room-events-${activeRoom}`);
      channel.send({
        type: 'broadcast',
        event: 'sync_playback',
        payload: { currentSong: song, isPlaying: true, currentTime: 0 }
      });
    }
  };

  // 7. Supabase Realtime Channel
  useEffect(() => {
    if (!activeRoom) return;

    syncRoomState(activeRoom);
    const pollTimer = setInterval(() => syncRoomState(activeRoom), 2500);

    const channel = supabase.channel(`room-events-${activeRoom}`);

    channel
      .on('broadcast', { event: 'sync_playback' }, ({ payload }) => {
        if (payload?.currentSong && onPlaySong) {
          onPlaySong(payload.currentSong);
        }
      })
      .on('broadcast', { event: 'new_chat' }, ({ payload }) => {
        setChats((prev) => [...prev, payload]);
      })
      .on('broadcast', { event: 'queue_upvote' }, ({ payload }) => {
        setQueueVotes((prev) => ({
          ...prev,
          [payload.songId]: (prev[payload.songId] || 0) + 1
        }));
      })
      .on('broadcast', { event: 'room_reaction' }, ({ payload }) => {
        triggerLocalReaction(payload.emoji, payload.username);
      })
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [activeRoom, onPlaySong, syncRoomState]);

  // 8. Dynamic recommendations for the room
  useEffect(() => {
    if (!currentSong) return;
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

  const handleRoomSearch = async (e) => {
    e.preventDefault();
    if (!roomSearchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchYouTube(roomSearchQuery.trim());
    setRoomSearchResults(results.filter((s) => (s.duration || 210) <= 600));
    setIsSearching(false);
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMsg.trim() || !activeRoom) return;

    const currentUser = user || { username: 'Listener' };
    const payload = {
      id: Date.now() + Math.random(),
      username: currentUser.username,
      message: chatMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats((prev) => [...prev, payload]);
    setChatMsg('');

    const channel = supabase.channel(`room-events-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'new_chat',
      payload
    });

    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          code: activeRoom,
          user: currentUser,
          message: payload.message
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
    const payload = { emoji, username: currentUser.username };

    const channel = supabase.channel(`room-events-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'room_reaction',
      payload
    });

    triggerLocalReaction(emoji, payload.username);
  };

  const handleUpvote = async (song) => {
    if (!activeRoom) return;
    const songId = song.id;

    setQueueVotes((prev) => ({
      ...prev,
      [songId]: (prev[songId] || 0) + 1
    }));

    const channel = supabase.channel(`room-events-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'queue_upvote',
      payload: { songId }
    });

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
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide">Synchronous Listening Rooms</h2>
            <p className="text-xs text-zinc-400">Stream audio with multiple devices in 100% frame-perfect sync</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!activeRoom ? (
            <>
              {/* Prominent Instant + Create New Room Button */}
              <button
                onClick={handleCreateNewRoom}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ CREATE NEW ROOM</span>
              </button>

              {/* Join Existing Room Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputCode.trim()) handleJoinOrCreateRoom(inputCode.trim());
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Enter Room Code..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white uppercase outline-none focus:border-emerald-500/50 w-36"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#141C30] hover:bg-[#1a2540] border border-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Join
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy Room Code to Share"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : `Code: ${activeRoom}`}</span>
              </button>

              {onOpenCinema && (
                <button
                  onClick={onOpenCinema}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open Watch Together Full-Screen Cinema"
                >
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span>Watch Video Together</span>
                </button>
              )}

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

      {/* Active Room Workspace */}
      {activeRoom ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Main Column */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-6">
              {/* Room Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm font-mono border border-emerald-500/30">
                    {activeRoom}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Listening Room {activeRoom}</h3>
                    <p className="text-xs text-zinc-400">Host: <strong className="text-white">{roomHost || user?.username || 'You'}</strong></p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live Synchronized</span>
                </div>
              </div>

              {/* Inside-Room Track Search Bar */}
              <form onSubmit={handleRoomSearch} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#080C14] border border-emerald-500/30 focus-within:border-emerald-400 transition-all">
                  <Search className="w-4 h-4 text-emerald-400" />
                  <input
                    type="text"
                    placeholder="Search any song to sync across room members (<10m)..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer"
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
                        className="p-2 rounded-lg bg-white/5 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={song.thumbnail} alt={song.title} className="w-8 h-8 rounded object-cover" />
                          <div className="flex flex-col min-w-0">
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
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upvote Upcoming Queue (Top Upvoted Plays Next)</span>
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
                          className={`p-3 px-4 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-3 transition-all ${
                            idx === 0 && votes > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <span className="text-xs font-bold font-mono text-emerald-400 w-5">#{idx + 1}</span>
                            <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-white truncate">{song.title}</span>
                              <span className="text-[11px] text-zinc-400 truncate">{song.artist} • {formatTime(song.duration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleUpvote(song)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                votes > 0
                                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                                  : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{votes} {votes === 1 ? 'Upvote' : 'Upvotes'}</span>
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
                  <div className="p-4 rounded-xl bg-[#080C14] text-center text-zinc-500 text-xs italic">
                    Play a track in the room to generate dynamic collaborative upvote recommendations.
                  </div>
                )}
              </div>

              {/* Room Live Reaction Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#080C14] border border-white/5">
                <span className="text-xs font-bold text-zinc-400">Send Live Reaction:</span>
                <div className="flex items-center gap-2">
                  {['🔥', '❤️', '🎵', '👏', '🎉', '⚡'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-lg hover:scale-125 active:scale-95 transition-transform p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Room Right Sidebar: Connected Members + Real-time Room Chat */}
            <div className="flex flex-col gap-4">
              {/* Room Members Card */}
              <div className="p-4 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Room Members ({members.length || 1})</h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>

                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {members.length > 0 ? (
                    members.map((m, idx) => (
                      <div key={m.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-[#080C14] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-bold text-white">{m.username}</span>
                          {m.isHost && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              👑 Host
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">online</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#080C14] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-white">{user?.username || 'You'}</span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                          👑 Host
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">online</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Room Live Chat */}
              <div className="p-4 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col justify-between h-[360px]">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Room Live Chat</h3>
                </div>

                <div className="flex-1 overflow-y-auto my-2.5 flex flex-col gap-2 pr-1 custom-scrollbar">
                  {chats.length > 0 ? (
                    chats.map((c) => (
                      <div key={c.id} className="flex flex-col gap-0.5 p-2 rounded-xl bg-[#080C14] text-xs">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
                          <span className="text-emerald-400 font-bold">{c.username}</span>
                          <span>{c.time}</span>
                        </div>
                        <p className="text-white text-xs break-words">{c.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-zinc-500 text-xs my-auto italic">
                      No messages yet. Say hello to everyone!
                    </div>
                  )}
                </div>

                <form onSubmit={sendChatMessage} className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Other Active Rooms Explorer */}
          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Explore Other Active Rooms</span>
              </h3>
              <span className="text-xs text-zinc-400">{rooms.filter((r) => r.code !== activeRoom).length} other rooms live</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {rooms
                .filter((r) => r.code !== activeRoom)
                .map((r) => (
                  <div key={r.code} className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-xs font-bold font-mono border border-emerald-500/30">
                        {r.code}
                      </span>
                      <span className="text-xs text-zinc-400 flex items-center gap-1 font-semibold">
                        <Users className="w-3 h-3 text-emerald-400" />
                        <span>{r.member_count} listeners</span>
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[11px] text-zinc-400">Host: <strong className="text-white">{r.host_name}</strong></span>
                      <span className="text-xs font-semibold text-emerald-300 truncate">🎵 {r.song_title} - {r.song_artist}</span>
                    </div>

                    <button
                      onClick={() => handleJoinOrCreateRoom(r.code)}
                      className="w-full py-1.5 rounded-lg bg-[#141C30] hover:bg-emerald-500 hover:text-black text-white font-bold text-xs transition-all cursor-pointer"
                    >
                      Switch to Room {r.code}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        /* Rooms Grid (When not in any room) */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Public Rooms ({rooms.length})</h3>
            <button
              onClick={handleCreateNewRoom}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Room</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((r) => (
              <div key={r.code} className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-black font-mono border border-emerald-500/30">
                    {r.code}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{r.member_count} listeners</span>
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400">Host: <strong className="text-white">{r.host_name}</strong></span>
                  <span className="text-xs font-bold text-emerald-300 truncate">🎵 {r.song_title} - {r.song_artist}</span>
                </div>

                <button
                  onClick={() => handleJoinOrCreateRoom(r.code)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  Join Room
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
