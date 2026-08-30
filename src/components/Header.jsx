'use client';
import React, { useState } from 'react';
import { Search, Sparkles, LogOut, Radio, UserPlus, LogIn } from 'lucide-react';

export default function Header({ user, onSearch, activeRoom, activeTab, onLogout, onOpenAuth }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('music'); // music, artist, mix

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query, category);
  };

  const isRoomView = activeTab === 'rooms' || Boolean(activeRoom);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 p-4 mb-2">
      {/* Search Input & Category Pills (Hidden when inside Rooms view) */}
      {!isRoomView ? (
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[320px] max-w-2xl flex flex-col gap-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus-within:border-purple-500/50 transition-all shadow-inner">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search tracks, artists, or mixes (<10m)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Search
            </button>
          </div>

          {/* Category Selector Pills */}
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={() => { setCategory('music'); if (onSearch) onSearch(query, 'music'); }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                category === 'music'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                  : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              🎵 Music (&lt;10m)
            </button>
            <button
              type="button"
              onClick={() => { setCategory('artist'); if (onSearch) onSearch(query, 'artist'); }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                category === 'artist'
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                  : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              👨‍🎤 Artist Mixes
            </button>
            <button
              type="button"
              onClick={() => { setCategory('mix'); if (onSearch) onSearch(query, 'mix'); }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                category === 'mix'
                  ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40'
                  : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              🔀 Mashups
            </button>
          </div>
        </form>
      ) : (
        <div className="flex-1 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
            <Radio className="w-4 h-4 animate-pulse text-cyan-400" />
            <span>Listening Room Mode • Realtime Synchronized</span>
          </div>
        </div>
      )}

      {/* Right Controls & User ID Status */}
      <div className="flex items-center gap-3">
        {activeRoom && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            <span>Room {activeRoom}</span>
          </div>
        )}

        {user ? (
          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl border border-white/10">
            <span className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-pink-500 shadow-[0_0_8px_#ec4899]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
            <span className="text-xs font-semibold text-white">{user.username}</span>
            {user.role === 'admin' && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Admin
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New ID</span>
          </button>
        )}

        {user && onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            title="Log Out / Switch ID"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
