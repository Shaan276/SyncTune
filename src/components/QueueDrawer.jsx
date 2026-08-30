'use client';
import React from 'react';
import { ListMusic, X, Play, Trash2, Sparkles, Plus, Mic2, Radio } from 'lucide-react';
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
  artistRecommendations = [],
  genreRecommendations = []
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full glass-panel border-l border-white/10 p-6 flex flex-col gap-6 shadow-2xl bg-zinc-950/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Playback Queue</h3>
              <p className="text-[11px] text-zinc-400 font-mono">{queue.length} upcoming tracks</p>
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-1">
          {/* 1. Now Playing Card */}
          {currentSong && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Now Playing
              </span>
              <div className="glass-card p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex items-center gap-3.5">
                <img
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{currentSong.title}</h4>
                  <p className="text-[11px] text-zinc-400 truncate">{currentSong.artist}</p>
                  <span className="text-[10px] text-cyan-400 font-mono mt-0.5">{formatTime(currentSong.duration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. User-Specified Next Queue */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                Next in Queue ({queue.length})
              </span>
            </div>

            {queue.length > 0 ? (
              <div className="flex flex-col gap-2">
                {queue.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className="glass-card p-2.5 px-3 rounded-xl flex items-center justify-between gap-3 group hover:border-purple-500/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[11px] font-mono font-bold text-zinc-500 w-4">{index + 1}</span>
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onPlaySong(song, index)}
                        className="p-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors cursor-pointer"
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
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-zinc-500 text-xs italic">
                Queue is empty. Click "+ Add to Queue" on any track.
              </div>
            )}
          </div>

          {/* 3. Queue: Same Artist Tracks */}
          {artistRecommendations.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                <Mic2 className="w-3.5 h-3.5" />
                <span>More by {currentSong?.artist || 'Same Artist'}</span>
              </div>

              <div className="flex flex-col gap-2">
                {artistRecommendations.slice(0, 5).map((song) => (
                  <div
                    key={song.id}
                    className="glass-card p-2.5 px-3 rounded-xl flex items-center justify-between gap-3 group hover:border-cyan-500/40 transition-all opacity-90 hover:opacity-100"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {onAddToQueue && (
                        <button
                          onClick={() => onAddToQueue(song)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                          title="Add to Queue"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onPlaySong(song)}
                        className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer"
                        title="Play Track"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Queue: Same Music Genre & Taste Mix */}
          {genreRecommendations.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" />
                <span>Similar Genre & Taste Mix</span>
              </div>

              <div className="flex flex-col gap-2">
                {genreRecommendations.slice(0, 5).map((song) => (
                  <div
                    key={song.id}
                    className="glass-card p-2.5 px-3 rounded-xl flex items-center justify-between gap-3 group hover:border-amber-500/40 transition-all opacity-90 hover:opacity-100"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {onAddToQueue && (
                        <button
                          onClick={() => onAddToQueue(song)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                          title="Add to Queue"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onPlaySong(song)}
                        className="p-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
                        title="Play Track"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
