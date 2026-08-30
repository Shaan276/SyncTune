'use client';
import React from 'react';
import { Home, Users, Music2, Shield, Radio, Sun, Moon, LogOut, UserPlus, LogIn } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, user, activeRoom, isDarkMode, setIsDarkMode, onOpenAuth, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rooms', label: 'Listening Rooms', icon: Radio, badge: activeRoom ? 'Active' : null },
    { id: 'playlists', label: 'Playlists', icon: Music2 },
    { id: 'friends', label: 'Friends', icon: Users },
  ];

  if (user && user.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Control', icon: Shield, badge: 'PRO' });
  }

  return (
    <aside className="w-64 glass-panel m-4 flex flex-col justify-between p-5 select-none transition-all duration-300">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight text-glow-purple">SyncTune</h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Low Data Stream</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/30 to-cyan-600/20 text-white border border-purple-500/30 shadow-md shadow-purple-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : ''}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Settings, User Profile & Auth */}
      <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-purple-400" />}
            <span>{isDarkMode ? 'Light Theme' : 'Dark Theme'}</span>
          </span>
          <span className="text-[10px] text-zinc-500 uppercase">{isDarkMode ? 'Dark' : 'Light'}</span>
        </button>

        {user ? (
          <div className="flex flex-col gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs flex items-center justify-center uppercase">
                  {user.username ? user.username.charAt(0) : 'U'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{user.username}</span>
                  <span className="text-[10px] text-zinc-400 capitalize">{user.role || 'Listener'}</span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={onOpenAuth}
              className="w-full py-1 text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3 h-3" />
              <span>Switch / New ID</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:opacity-90 transition-opacity"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Create ID</span>
          </button>
        )}
      </div>
    </aside>
  );
}
