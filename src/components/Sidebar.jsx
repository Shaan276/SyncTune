'use client';
import React from 'react';
import {
  Compass,
  Radio,
  Users,
  Shield,
  Zap,
  LogOut,
  User,
  Heart,
  X
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  activeRoom,
  onCreateRoomQuick,
  onOpenAuth,
  onLogout,
  isMobileOpen = false,
  onCloseMobile
}) {
  const coreNav = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'rooms', label: 'Listening Rooms', icon: Radio, badge: activeRoom ? `Synced` : null },
    { id: 'playlists', label: 'My Playlists', icon: Heart },
    { id: 'friends', label: 'Friends & Live Sync', icon: Users },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-64 bg-[#0B0F19] border-r border-white/5 flex flex-col justify-between p-4 select-none shrink-0 h-full overflow-y-auto custom-scrollbar">
      {/* Top Branding & Navigation */}
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-black text-base text-white tracking-wider truncate">SYNCTUNE</h1>
              <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest">AUDIO OS</p>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Big Create Room Action Button */}
        <button
          onClick={() => {
            if (onCreateRoomQuick) {
              onCreateRoomQuick();
            } else {
              handleSelectTab('rooms');
            }
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
        >
          <Zap className="w-4 h-4 fill-black" />
          <span>+ CREATE ROOM</span>
        </button>

        {/* Section: Administration (for Admins only) */}
        {user && user.role === 'admin' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-3">
              ADMINISTRATION
            </span>
            <button
              onClick={() => handleSelectTab('admin')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Admin Control</span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
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
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer min-w-0 ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#162238] text-emerald-400 border border-emerald-500/20 shrink-0 ml-1">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer User Profile */}
      <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
        {user ? (
          <div className="p-2.5 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-xs flex items-center justify-center uppercase shrink-0">
                  {user.username ? user.username.charAt(0) : 'U'}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-white truncate">{user.username}</span>
                  <span className="text-[10px] text-zinc-500 font-semibold truncate capitalize">
                    {user.role === 'admin' ? '👑 Admin' : '🎧 Listener'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 ml-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              onOpenAuth();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-[#141C30] hover:bg-[#1a2540] border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Collapsible Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full max-w-[280px] w-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
