'use client';
import React, { useState } from 'react';
import { Users, UserPlus, Radio, UserCheck, Trash2, Search } from 'lucide-react';

export default function FriendsView({ user, activeRoom, setActiveRoom }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([
    { id: 1, name: 'Aarav Sharma', email: 'aarav@gmail.com', status: 'listening', is_online: true, active_room: 'BEAT1' },
    { id: 2, name: 'Ananya Verma', email: 'ananya@gmail.com', status: 'active', is_online: true, active_room: null },
    { id: 3, name: 'Rohan Gupta', email: 'rohan@gmail.com', status: 'offline', is_online: false, active_room: null },
  ]);

  const handleAddFriend = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    alert(`Friend request sent to ${searchQuery}`);
    setSearchQuery('');
  };

  const handleRemoveFriend = (id) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div>
        <h2 className="text-2xl font-black text-white text-glow-purple flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-400" />
          <span>Friends & Live Telemetry</span>
        </h2>
        <p className="text-xs text-zinc-400">See what your friends are listening to in real-time and join their rooms</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Friends List */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Friends ({friends.length})</h3>

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
                <div key={f.id} className="glass-card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 font-bold text-sm flex items-center justify-center uppercase">
                        {f.name.charAt(0)}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                          f.is_online ? 'bg-emerald-400' : 'bg-zinc-600'
                        }`}
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{f.name}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColor} w-max mt-0.5`}>
                        {statusText}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.active_room && f.active_room !== activeRoom && (
                      <button
                        onClick={() => setActiveRoom(f.active_room)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all"
                      >
                        Join Room {f.active_room}
                      </button>
                    )}

                    {activeRoom && f.is_online && !f.active_room && (
                      <button
                        onClick={() => alert(`Invited ${f.name} to room ${activeRoom}`)}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all"
                      >
                        Invite
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveFriend(f.id)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Unfriend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Friends Section */}
        <div className="glass-panel p-6 flex flex-col gap-4 h-max">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-400" />
            <span>Add New Friends</span>
          </h3>

          <form onSubmit={handleAddFriend} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-white/10">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Enter email or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-white outline-none"
              />
            </div>
            <button
              type="submit"
              className="py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs hover:opacity-90 transition-opacity"
            >
              Send Friend Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
