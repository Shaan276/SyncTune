'use client';
import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Film, ListMusic } from 'lucide-react';
import { formatTime } from '../lib/youtube';

export default function PlayerFooter({
  currentSong,
  isPlaying,
  onTogglePlay,
  onPlayPause,
  onSkipNext,
  onSkipPrev,
  currentTime = 0,
  duration = 100,
  onSeek,
  volume = 0.8,
  onVolumeChange,
  history = [],
  likedSongs = [],
  onToggleLike,
  onToggleCinema,
  queue = [],
  onToggleQueue,
  isQueueOpen
}) {
  const [isMuted, setIsMuted] = useState(false);
  const isLiked = currentSong && likedSongs.some(s => s.id === currentSong.id);
  const handlePlayClick = onTogglePlay || onPlayPause;

  const handleSliderSeek = (e) => {
    const newSec = parseFloat(e.target.value);
    if (onSeek) {
      onSeek(newSec);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 p-3 px-6 flex items-center justify-between gap-4 z-40 select-none shadow-2xl">
      {/* Left: Track Info */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-white/10 overflow-hidden flex-shrink-0 shadow-md">
          {currentSong?.thumbnail ? (
            <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-purple-400 font-bold text-xs">
              Sync
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h4 className="text-xs font-bold text-white truncate">{currentSong?.title || 'No song playing'}</h4>
          <p className="text-[11px] text-zinc-400 truncate">{currentSong?.artist || 'Search or pick a track to play'}</p>
        </div>
        {currentSong && onToggleLike && (
          <button
            onClick={() => onToggleLike(currentSong)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLiked ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Middle: Controls & Progress */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
        <div className="flex items-center gap-5">
          <button
            onClick={onSkipPrev}
            disabled={history.length <= 1}
            className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={handlePlayClick}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>

          <button
            onClick={onSkipNext}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Queue Button */}
          {onToggleQueue && (
            <button
              onClick={onToggleQueue}
              className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 text-[11px] font-bold cursor-pointer ${
                isQueueOpen
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20'
              }`}
              title="Toggle Playback Queue"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue {queue.length > 0 ? `(${queue.length})` : ''}</span>
            </button>
          )}

          {onToggleCinema && (
            <button
              onClick={onToggleCinema}
              className="p-2 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              title="Toggle Watch Together Cinema"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Cinema</span>
            </button>
          )}
        </div>

        {/* Seek Bar */}
        <div className="flex items-center gap-3 w-full text-[10px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="1"
            value={currentTime || 0}
            onChange={handleSliderSeek}
            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Ultra Low Data Badge */}
      <div className="flex items-center justify-end gap-4 w-1/4 min-w-[180px]">
        <div className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold font-mono">
          Ultra-Low Data ⚡ ~1MB
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setIsMuted(false);
              onVolumeChange && onVolumeChange(parseFloat(e.target.value));
            }}
            className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
        </div>
      </div>
    </footer>
  );
}
