'use client';
import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, ListMusic, Repeat, ListPlus, Check, X, FolderPlus, Disc } from 'lucide-react';
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
  customPlaylists = [],
  onAddToPlaylist,
  onCreatePlaylist,
  queue = [],
  onToggleQueue,
  isQueueOpen,
  isLooping = false,
  onToggleLoop,
  isReadOnly = false
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);

  const isLiked = currentSong && likedSongs.some((s) => s.id === currentSong.id);
  
  const handlePlayClick = () => {
    if (isReadOnly) return;
    if (onTogglePlay) onTogglePlay();
    else if (onPlayPause) onPlayPause();
  };

  const handleSkipNextClick = () => {
    if (isReadOnly) return;
    if (onSkipNext) onSkipNext();
  };

  const handleSkipPrevClick = () => {
    if (isReadOnly) return;
    if (onSkipPrev) onSkipPrev();
  };

  const handleSliderSeek = (e) => {
    if (isReadOnly) return;
    const newSec = parseFloat(e.target.value);
    if (onSeek) {
      onSeek(newSec);
    }
  };

  const handleQuickCreateAndAdd = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !currentSong) return;
    if (onCreatePlaylist) {
      const created = onCreatePlaylist(newPlaylistName.trim());
      if (created && onAddToPlaylist) {
        onAddToPlaylist(created.id, currentSong);
        setJustAddedId(created.id);
        setTimeout(() => setJustAddedId(null), 3000);
      }
    }
    setNewPlaylistName('');
  };

  const handleAddSongToPl = (playlistId) => {
    if (!currentSong || !onAddToPlaylist) return;
    onAddToPlaylist(playlistId, currentSong);
    setJustAddedId(playlistId);
    setTimeout(() => setJustAddedId(null), 3000);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0B0F19] border-t border-white/10 z-40 select-none shadow-2xl">
        {/* 1. Sleek Full-Width Top Progress Bar (Interactive scrubber) */}
        <div className="relative w-full h-1 bg-[#141C30] hover:h-2 transition-all cursor-pointer group">
          <div
            className="h-full bg-emerald-400 transition-[width] duration-150 relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-emerald-300 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="1"
            value={currentTime || 0}
            onChange={handleSliderSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Seek playback time"
          />
        </div>

        {/* 2. Main Player Bar Content */}
        <div className="p-2.5 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Track Info & Thumbnail */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:w-1/4 sm:min-w-[180px] sm:max-w-[300px] min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#141C30] border border-white/10 overflow-hidden shrink-0 shadow-md">
              {currentSong?.thumbnail ? (
                <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-emerald-400 font-black text-xs">
                  Sync
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{currentSong?.title || 'No song playing'}</h4>
              <p className="text-[11px] text-zinc-400 truncate">{currentSong?.artist || 'Pick a track or join a room'}</p>
            </div>

            {/* Like & Save to Playlist actions */}
            {currentSong && (
              <div className="flex items-center gap-1 shrink-0">
                {onToggleLike && (
                  <button
                    onClick={() => onToggleLike(currentSong)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isLiked ? 'text-pink-500 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                    }`}
                    title={isLiked ? 'Unlike track' : 'Like track'}
                  >
                    <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                  </button>
                )}

                <button
                  onClick={() => setShowPlaylistModal(true)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  title="Save to Playlist"
                >
                  <ListPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Middle: Desktop Playback Controls & Timeline */}
          <div className="hidden sm:flex flex-col items-center gap-1.5 flex-1 max-w-xl min-w-0">
            <div className="flex items-center gap-3 sm:gap-5">
              {/* Loop / Repeat Button */}
              <button
                onClick={onToggleLoop}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isLooping
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                title={isLooping ? 'Loop Song: ON (Click to Disable)' : 'Loop Song: OFF (Click to Enable)'}
              >
                <Repeat className="w-4 h-4" />
              </button>

              <button
                onClick={handleSkipPrevClick}
                disabled={isReadOnly || history.length <= 1}
                className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title={isReadOnly ? 'Only host can control music' : 'Previous Track'}
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={handlePlayClick}
                disabled={isReadOnly}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 transition-all ${
                  isReadOnly
                    ? 'bg-amber-500/80 text-black cursor-not-allowed opacity-75'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25 hover:scale-105 active:scale-95 cursor-pointer'
                }`}
                title={isReadOnly ? 'Music is controlled by room host' : (isPlaying ? 'Pause' : 'Play')}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 ml-0.5 fill-black" />}
              </button>

              <button
                onClick={handleSkipNextClick}
                disabled={isReadOnly}
                className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title={isReadOnly ? 'Only host can control music' : 'Next Track'}
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Desktop Time Indicators */}
            <div className="flex items-center justify-between w-full text-[10px] text-zinc-400 font-mono px-1">
              <span>{currentSong ? formatTime(currentTime) : '0:00'}</span>
              <span>{currentSong ? formatTime(duration) : '0:00'}</span>
            </div>
          </div>

          {/* Right on Desktop: Volume Slider */}
          <div className="hidden sm:flex items-center justify-end gap-3 sm:gap-4 sm:w-1/4 sm:min-w-[130px] sm:max-w-[220px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
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
                className="w-16 sm:w-20 h-1.5 bg-[#141C30] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>

          {/* Right on Mobile (< 640px): Ultra-clean Compact Controls */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {/* Mobile Skip Previous */}
            <button
              onClick={handleSkipPrevClick}
              disabled={isReadOnly || !history || history.length <= 1}
              className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={isReadOnly ? 'Only host can control music' : 'Previous Track'}
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Mobile Big Play/Pause Button */}
            <button
              onClick={handlePlayClick}
              disabled={isReadOnly}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isReadOnly
                  ? 'bg-amber-500/80 text-black cursor-not-allowed opacity-75'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer'
              }`}
              title={isReadOnly ? 'Music is controlled by room host' : (isPlaying ? 'Pause' : 'Play')}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 ml-0.5 fill-black" />}
            </button>

            {/* Mobile Skip Next */}
            <button
              onClick={handleSkipNextClick}
              disabled={isReadOnly}
              className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={isReadOnly ? 'Only host can control music' : 'Next Track'}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Save to Playlist Modal */}
      {showPlaylistModal && currentSong && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F1626] border border-white/10 shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ListPlus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Save to Playlist</h3>
              </div>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Song Preview */}
            <div className="p-2.5 rounded-xl bg-[#080C14] border border-white/5 flex items-center gap-3">
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-white truncate">{currentSong.title}</span>
                <span className="text-[10px] text-zinc-400 truncate">{currentSong.artist}</span>
              </div>
            </div>

            {/* Playlists List */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {/* Liked Songs Entry */}
              <div
                onClick={() => onToggleLike && onToggleLike(currentSong)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  isLiked
                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                    : 'bg-[#080C14] border-white/5 text-zinc-300 hover:border-pink-500/30'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Heart className={`w-4 h-4 shrink-0 ${isLiked ? 'fill-current text-pink-500' : 'text-zinc-500'}`} />
                  <span className="text-xs font-bold truncate">Liked Songs</span>
                </div>
                {isLiked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" /> Saved
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-bold shrink-0">+ Add</span>
                )}
              </div>

              {/* Custom Playlists */}
              {customPlaylists.map((pl) => {
                const inPl = (pl.songs || []).some((s) => s.id === currentSong.id);
                const isJustAdded = justAddedId === pl.id;

                return (
                  <div
                    key={pl.id}
                    onClick={() => !inPl && handleAddSongToPl(pl.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      inPl || isJustAdded
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-[#080C14] border-white/5 text-zinc-300 hover:border-emerald-500/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Disc className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">{pl.name}</span>
                        <span className="text-[10px] text-zinc-400">{(pl.songs || []).length} tracks</span>
                      </div>
                    </div>

                    {inPl || isJustAdded ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-400 hover:text-emerald-400 shrink-0">+ Add</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick New Playlist Creator */}
            <form onSubmit={handleQuickCreateAndAdd} className="flex gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                placeholder="New playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold shrink-0 transition-colors cursor-pointer"
              >
                + Add
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
