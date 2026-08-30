'use client';
import React from 'react';
import { Tv, X, Radio, Sparkles } from 'lucide-react';

export default function CinemaPlayer({ isOpen, onClose, currentSong, activeRoom }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white">SyncTune Cinema • Full Screen</h3>
              {activeRoom && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  Room {activeRoom} Synced
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-md">
              {currentSong?.title ? `${currentSong.title} — ${currentSong.artist}` : 'Watch video stream in sync with all room members'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
        >
          <X className="w-4 h-4" />
          <span>Exit Cinema</span>
        </button>
      </div>

      {/* Full-Screen Embedded Video Area */}
      <div className="relative w-full flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
        {currentSong?.id ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${currentSong.id}?autoplay=1&controls=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-500 text-center">
            <Tv className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">Select any song in the room to launch Cinema Video</p>
          </div>
        )}
      </div>
    </div>
  );
}
