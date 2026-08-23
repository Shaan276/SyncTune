'use client';
import React, { useState, useEffect } from 'react';
import { Radio, Plus, MessageSquare, ThumbsUp, Users, Play, Lock, Unlock, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function RoomsView({ user, activeRoom, setActiveRoom, onPlaySong }) {
  const [rooms, setRooms] = useState([
    { code: 'BEAT1', host_name: 'Piyush', member_count: 5, song_title: 'One Love', song_artist: 'Shubh', is_playing: 1 },
    { code: 'CHILL', host_name: 'Alex', member_count: 3, song_title: 'Softly', song_artist: 'Karan Aujla', is_playing: 1 }
  ]);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [chats, setChats] = useState([]);
  const [queueVotes, setQueueVotes] = useState({});

  useEffect(() => {
    if (!activeRoom) return;

    // Listen to real-time chats via Supabase channel
    const channel = supabase.channel(`room-chats-${activeRoom}`);

    channel
      .on('broadcast', { event: 'new_chat' }, ({ payload }) => {
        setChats((prev) => [...prev, payload]);
      })
      .on('broadcast', { event: 'queue_upvote' }, ({ payload }) => {
        setQueueVotes((prev) => ({
          ...prev,
          [payload.songId]: (prev[payload.songId] || 0) + 1
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const code = newRoomCode.toUpperCase().trim() || Math.random().toString(36).substring(2, 7).toUpperCase();
    setActiveRoom(code);
    setNewRoomCode('');
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatMsg.trim() || !activeRoom) return;

    const payload = {
      id: Date.now(),
      username: user?.username || 'Listener',
      message: chatMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const channel = supabase.channel(`room-chats-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'new_chat',
      payload
    });

    setChats((prev) => [...prev, payload]);
    setChatMsg('');
  };

  const handleUpvote = (songId) => {
    if (!activeRoom) return;
    const channel = supabase.channel(`room-chats-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'queue_upvote',
      payload: { songId }
    });
    setQueueVotes((prev) => ({
      ...prev,
      [songId]: (prev[songId] || 0) + 1
    }));
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white text-glow-cyan flex items-center gap-2">
            <Radio className="w-6 h-6 text-cyan-400" />
            <span>Listening Rooms</span>
          </h2>
          <p className="text-xs text-zinc-400">Join synchronous listening rooms or host your own live audio stream</p>
        </div>

        {!activeRoom ? (
          <form onSubmit={handleCreateRoom} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter room code..."
              value={newRoomCode}
              onChange={(e) => setNewRoomCode(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white uppercase outline-none focus:border-cyan-500/50"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Create / Join</span>
            </button>
          </form>
        ) : (
          <button
            onClick={() => setActiveRoom(null)}
            className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Room {activeRoom}</span>
          </button>
        )}
      </div>

      {/* Active Room Workspace */}
      {activeRoom ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Playback & Upvoting Section */}
          <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                  {activeRoom}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Listening Room {activeRoom}</h3>
                  <p className="text-xs text-zinc-400">Host: {user?.username || 'You'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Synchronized</span>
              </div>
            </div>

            {/* Collaborative Queue Upvotes (New Feature!) */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Upvote Upcoming Queue Tracks</span>
              </h4>

              <div className="flex flex-col gap-2">
                {['One Love - Shubh', 'Elevated - Shubh', 'Softly - Karan Aujla'].map((song, idx) => (
                  <div key={idx} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-purple-400 font-mono">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-white">{song}</span>
                    </div>
                    <button
                      onClick={() => handleUpvote(song)}
                      className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{queueVotes[song] || 0} Upvotes</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Room Chat */}
          <div className="glass-panel p-5 flex flex-col justify-between h-[450px]">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Room Live Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto my-3 flex flex-col gap-2.5 pr-1">
              {chats.length > 0 ? (
                chats.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1 p-2 rounded-lg bg-white/5 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
                      <span className="text-cyan-400">{c.username}</span>
                      <span>{c.time}</span>
                    </div>
                    <p className="text-white">{c.message}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 text-xs my-auto italic">
                  No messages yet. Say hello to the room!
                </div>
              )}
            </div>

            <form onSubmit={sendChatMessage} className="flex items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                placeholder="Type chat message..."
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-cyan-600 text-white font-bold text-xs hover:bg-cyan-500 transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Rooms Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((r) => (
            <div key={r.code} className="glass-card p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs font-black font-mono border border-purple-500/30">
                  {r.code}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{r.member_count} listeners</span>
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Host: <strong className="text-white">{r.host_name}</strong></span>
                <span className="text-xs font-bold text-cyan-300 truncate">🎵 {r.song_title} - {r.song_artist}</span>
              </div>

              <button
                onClick={() => setActiveRoom(r.code)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Join Room
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
