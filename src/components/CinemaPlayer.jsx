'use client';
import React, { useState } from 'react';
import { Tv, X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

export default function CinemaPlayer({ isOpen, onClose, currentSong, isRoom }) {
  const [isTheatreMode, setIsTheatreMode] = useState(false);

  if (!isOpen || !isRoom) return null;

  const openPiP = () => {
    if (!currentSong) return;
    const width = 450;
    const height = 300;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const pipUrl = `pip_player.html?videoId=${currentSong.id}&volume=0.8`;
    window.open(
      pipUrl,
      'SyncTuneCinemaPiP',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=no,resizable=no,menubar=no,toolbar=no`
    );
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isTheatreMode
          ? 'top-4 left-4 right-4 bottom-24 glass-panel p-4 flex flex-col'
          : 'bottom-24 right-6 w-96 glass-panel p-4 flex flex-col shadow-2xl border border-purple-500/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white">SyncTune Cinema</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
            Live Synced Room
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={openPiP}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Open Picture-in-Picture"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsTheatreMode(!isTheatreMode)}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Toggle Theater Mode"
          >
            {isTheatreMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative w-full flex-1 min-h-[200px] bg-black/60 rounded-xl overflow-hidden flex items-center justify-center border border-white/5">
        {currentSong?.id ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${currentSong.id}?autoplay=1&controls=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500 p-6 text-center">
            <Tv className="w-8 h-8 opacity-40" />
            <p className="text-xs font-medium">Search or play a video track to start Cinema Sync</p>
          </div>
        )}
      </div>
    </div>
  );
}
