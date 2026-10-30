'use client';
import React from 'react';
import { Home, Users, Music2, Shield, Radio, Tv, History, Sparkles, LogOut, UserPlus, Zap } from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  activeRoom,
  onCreateRoomQuick,
  onOpenCinema,
  onOpenAuth,
  onLogout
}) {
  const coreNav = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rooms', label: 'Listening Rooms', icon: Radio, badge: activeRoom ? `Room ${activeRoom}` : '3 Live' },
    { id: 'playlists', label: 'My Playlists', icon: Music2 },
    { id: 'friends', label: 'Friends & Live Sync', icon: Users },
  ];

  return (
    <aside className="w-64 bg-[#0B0F19] border-r border-white/5 flex flex-col justify-between p-4 select-none shrink-0 h-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-base text-white tracking-wider">SYNCTUNE</h1>
            <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest">AUDIO OS</p>
          </div>
        </div>

        {/* Primary CTA Button (Matching Nutri-Track '+ QUICK LOG') */}
        <button
          onClick={() => {
            if (onCreateRoomQuick) {
              onCreateRoomQuick();
            } else {
              setActiveTab('rooms');
            }
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
        >
          <Zap className="w-4 h-4 fill-black" />
          <span>+ CREATE ROOM</span>
        </button>

        {/* Section: Administration (for Piyush) */}
        {user && user.role === 'admin' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-3">
              ADMINISTRATION
            </span>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'admin'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Admin Control Center</span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                PRO
              </span>
            </button>
          </div>
        )}

        {/* Section: Core Navigation */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-3">
            CORE NAVIGATION
          </span>
          <nav className="flex flex-col gap-1">
            {coreNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#162238] text-emerald-400 border border-emerald-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section: Audio Features & Lab */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-3">
            MUSIC LAB & STREAMING
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-medium">Ultra-Low Data</span>
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                ON ⚡ ~1MB
              </span>
            </div>

            {onOpenCinema && (
              <button
                onClick={onOpenCinema}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[11px]">Cinema Watch Together</span>
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  FULL
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer User Profile (Matching Nutri-Track bottom bar) */}
      <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
        {user ? (
          <div className="p-2.5 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-xs flex items-center justify-center uppercase">
                  {user.username ? user.username.charAt(0) : 'U'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{user.username}</span>
                  <span className="text-[10px] text-zinc-500 font-semibold truncate capitalize">
                    {user.role === 'admin' ? '👑 Admin' : '🎧 Listener'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={onOpenAuth}
              className="w-full py-1.5 text-[10px] font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3 h-3 text-emerald-400" />
              <span>Switch / New ID</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <span>Sign In / Create ID</span>
          </button>
        )}
      </div>
    </aside>
  );
}
