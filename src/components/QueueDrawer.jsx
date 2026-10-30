'use client';
import React from 'react';
import { ListMusic, X, Play, Trash2, Plus, Mic2, Radio, Sparkles } from 'lucide-react';
import { formatTime } from '../lib/youtube';

export default function QueueDrawer({
  isOpen,
  onClose,
  currentSong,
  queue = [],
  onPlaySong,
  onAddToQueue,
  onRemoveFromQueue,
  onClearQueue,
  autoplayMode = 'taste',
  setAutoplayMode
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-[#0B0F19] border-l border-white/5 p-5 sm:p-6 flex flex-col gap-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Playback Queue</h3>
              <p className="text-[10px] text-emerald-400 font-mono">10-Track Dynamic Rolling Buffer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && onClearQueue && (
              <button
                onClick={onClearQueue}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear Entire Queue"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOP PRIORITY: Autoplay Mode Preference Selector (Same Artist vs Same Taste) */}
        <div className="p-3 rounded-2xl bg-[#0F1626] border border-white/10 flex flex-col gap-2 shrink-0 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autoplay Recommendation Flow</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {autoplayMode === 'taste' ? 'Vibe / Genre' : 'Same Artist'}
            </span>
          </div>

          <div className="flex p-1 rounded-xl bg-[#080C14] border border-white/5 gap-1">
            <button
              type="button"
              onClick={() => setAutoplayMode && setAutoplayMode('taste')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                autoplayMode === 'taste'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Same Taste & Genre</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoplayMode && setAutoplayMode('artist')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                autoplayMode === 'artist'
                  ? 'bg-cyan-500 text-black font-extrabold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Same Artist Only</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content: Now Playing & Upcoming Queue */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1">
          {/* 1. Now Playing Card */}
          {currentSong && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Now Playing
              </span>
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3.5">
                <img
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{currentSong.title}</h4>
                  <p className="text-[11px] text-zinc-400 truncate">{currentSong.artist}</p>
                  <span className="text-[10px] text-emerald-400 font-mono mt-0.5">{formatTime(currentSong.duration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Upcoming Rolling Buffer Queue (10 songs) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Upcoming Tracks</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                  {queue.length}
                </span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-refilling buffer</span>
            </div>

            {queue.length > 0 ? (
              <div className="flex flex-col gap-2">
                {queue.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className="p-2.5 px-3 rounded-xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-3 group hover:border-emerald-500/30 transition-all min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 w-5 shrink-0">#{index + 1}</span>
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{song.artist} • {formatTime(song.duration)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onPlaySong(song, index)}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                        title="Play Now"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                      {onRemoveFromQueue && (
                        <button
                          onClick={() => onRemoveFromQueue(index)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remove from Queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#0F1626] border border-white/5 text-center text-zinc-500 text-xs italic">
                Queue is buffering recommendations...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
