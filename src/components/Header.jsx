'use client';
import React from 'react';
import { Calendar, Radio, Menu } from 'lucide-react';

export default function Header({
  user,
  activeRoom,
  activeTab,
  onCreateRoomQuick,
  onOpenAuth,
  onLogout,
  onToggleMobileSidebar
}) {
  const getPageTitle = () => {
    switch (activeTab) {
      case 'rooms':
        return activeRoom ? `Room ${activeRoom}` : 'Listening Rooms';
      case 'playlists':
        return 'Playlists';
      case 'friends':
        return 'Friends & Listeners';
      case 'admin':
        return 'Admin Control Center';
      default:
        return 'Dashboard';
    }
  };

  const currentDateFormatted = () => {
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-[#080C14] border-b border-white/5 flex items-center justify-between gap-3 select-none shrink-0 z-20">
      {/* Left: Mobile Menu Toggle + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-[#0F1626] border border-white/10 text-zinc-300 hover:text-white cursor-pointer active:scale-95 shrink-0"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5 text-emerald-400" />
        </button>

        <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate">{getPageTitle()}</h2>
        
        {activeRoom && (
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold font-mono shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Room {activeRoom} Synced</span>
          </span>
        )}
      </div>

      {/* Right: Date, Quick Room, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Date Pill (Hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F1626] border border-white/5 text-xs text-zinc-300 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>{currentDateFormatted()}</span>
        </div>

        {/* Quick Room Action Button */}
        <button
          onClick={onCreateRoomQuick}
          className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
          title="Create or Join Listening Room"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">QUICK ROOM</span>
        </button>

        {/* User Profile Avatar */}
        {user ? (
          <div
            onClick={onOpenAuth}
            className="w-9 h-9 rounded-xl bg-[#0F1626] border border-white/10 hover:border-emerald-500/40 flex items-center justify-center cursor-pointer transition-colors relative"
            title={`${user.username} (${user.role || 'user'}) - Click to switch`}
          >
            <span className="text-xs font-black text-emerald-400 uppercase">
              {user.username ? user.username.charAt(0) : 'U'}
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#080C14]" />
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-xl bg-[#0F1626] hover:bg-[#141C30] border border-white/10 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
