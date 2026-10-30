'use client';
import React, { useState } from 'react';
import { Users, UserPlus, Radio, UserCheck, Trash2, Search, Zap } from 'lucide-react';

export default function FriendsView({ user, activeRoom, setActiveRoom, setActiveTab }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([
    { id: 1, name: 'Aarav Sharma', email: 'aarav@gmail.com', status: 'listening', is_online: true, active_room: 'BEAT1' },
    { id: 2, name: 'Ananya Verma', email: 'ananya@gmail.com', status: 'active', is_online: true, active_room: null },
    { id: 3, name: 'Rohan Gupta', email: 'rohan@gmail.com', status: 'offline', is_online: false, active_room: null },
  ]);

  const handleAddFriend = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const newFriend = {
      id: Date.now(),
      name: searchQuery.trim(),
      email: `${searchQuery.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      status: 'active',
      is_online: true,
      active_room: null
    };
    setFriends((prev) => [newFriend, ...prev]);
    setSearchQuery('');
  };

  const handleRemoveFriend = (id) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
  };

  const handleJoinFriendRoom = (code) => {
    if (setActiveRoom) setActiveRoom(code);
    if (setActiveTab) setActiveTab('rooms');
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide">Friends & Live Sync</h2>
            <p className="text-xs text-zinc-400">See what your friends are listening to and join their rooms with 1 click</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Friends List */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Your Connected Friends ({friends.length})</h3>

          <div className="flex flex-col gap-3">
            {friends.map((f) => {
              const statusColor = f.is_online
                ? f.status === 'listening'
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-zinc-500 bg-zinc-800/40 border-zinc-700/40';

              const statusText = f.is_online
                ? f.status === 'listening'
                  ? 'Listening 🎧'
                  : 'Active 🟢'
                : 'Offline ⚪';

              return (
                <div key={f.id} className="p-3.5 px-4 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-4 hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center justify-center uppercase">
                        {f.name.charAt(0)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080C14] ${
                          f.is_online ? 'bg-emerald-500' : 'bg-zinc-600'
                        }`}
                      />
                    </div>

                    <div className="flex flex-col">
                      <h4 className="text-xs font-bold text-white">{f.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                          {statusText}
                        </span>
                        {f.active_room && (
                          <span className="text-[10px] text-cyan-400 font-mono font-bold">
                            In Room {f.active_room}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {f.active_room && (
                      <button
                        onClick={() => handleJoinFriendRoom(f.active_room)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Join Room</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveFriend(f.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove Friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Friend Sidebar Widget */}
        <div className="p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Add New Friend</h3>
          </div>

          <form onSubmit={handleAddFriend} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-300">Username or Email</label>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/50">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="e.g. Alex, ananya@gmail.com..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Send Invite</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
