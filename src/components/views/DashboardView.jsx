'use client';
import React, { useState, useEffect } from 'react';
import { Play, Plus, Heart, Music, Sparkles, TrendingUp, History, Trash2, Flame } from 'lucide-react';
import { getTop10RecommendedSongs, formatListenCount, getSongListenCount } from '../../lib/youtube';

export default function DashboardView({
  searchResults,
  onPlaySong,
  onAddToQueue,
  likedSongs,
  onToggleLike,
  history = [],
  onClearHistory
}) {
  const [topSongs, setTopSongs] = useState([]);

  useEffect(() => {
    setTopSongs(getTop10RecommendedSongs());
  }, [history]);

  return (
    <div className="flex flex-col gap-8 pb-32">
      {/* Hero Banner */}
      <div className="glass-panel p-8 rounded-2xl bg-gradient-to-r from-purple-900/40 via-cyan-900/20 to-black/40 border border-purple-500/20 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Low Data High Fidelity Audio Stream</span>
        </div>
        <h2 className="text-3xl font-black text-white text-glow-purple">
          Welcome to SyncTune ⚡
        </h2>
        <p className="text-sm text-zinc-300 max-w-xl leading-relaxed">
          Listen to synchronized music in real-time with your friends. Discover trending global hits, view live play counts, and build listening rooms.
        </p>
      </div>

      {/* 1. Search Results Section (If query active) */}
      {searchResults && searchResults.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-cyan-400" />
              <span>Search Results</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono">{searchResults.length} tracks found</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchResults.map((song) => {
              const isLiked = likedSongs && likedSongs.some((s) => s.id === song.id);
              const playCount = getSongListenCount(song.id, song.basePlays || 45000);

              return (
                <div
                  key={song.id}
                  className="glass-card p-3.5 flex flex-col gap-2.5 group hover:border-purple-500/40 transition-all"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                    <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    
                    {/* Play Count Badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-cyan-300 border border-white/10 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>{formatListenCount(playCount)}</span>
                    </div>

                    {/* Hover Overlay Play Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        onClick={() => onPlaySong(song)}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                        title="Play Now"
                      >
                        <Play className="w-4 h-4 ml-0.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onAddToQueue(song)}
                        className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
                        title="Add to Queue"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                    </div>

                    {onToggleLike && (
                      <button
                        onClick={() => onToggleLike(song)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Top 10 Most Frequently Listened To Songs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 text-glow-purple">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span>Top 10 Most Listened Songs</span>
            </h3>
            <p className="text-xs text-zinc-400">Ranked by total global and user play counts</p>
          </div>
          <span className="text-xs text-purple-300 font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
            🔥 Chart Toppers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {topSongs.map((song, index) => {
            const isLiked = likedSongs && likedSongs.some((s) => s.id === song.id);
            const rank = index + 1;
            const playCount = getSongListenCount(song.id, song.basePlays || 50000);

            return (
              <div
                key={song.id}
                className="glass-card p-3.5 flex flex-col gap-2.5 group hover:border-purple-500/40 transition-all relative overflow-hidden"
              >
                {/* Rank Number Badge */}
                <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] shadow-md ${
                  rank === 1 ? 'bg-amber-400 text-black shadow-amber-400/30' :
                  rank === 2 ? 'bg-zinc-300 text-black shadow-zinc-300/30' :
                  rank === 3 ? 'bg-amber-600 text-white shadow-amber-600/30' :
                  'bg-black/60 text-purple-300 border border-white/10'
                }`}>
                  #{rank}
                </div>

                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                  <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  
                  {/* Play Count Badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-cyan-300 border border-white/10 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>{formatListenCount(playCount)}</span>
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <button
                      onClick={() => onPlaySong(song)}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                      title="Play Track"
                    >
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    </button>
                    <button
                      onClick={() => onAddToQueue(song)}
                      className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
                      title="Add to Queue"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                  </div>

                  {onToggleLike && (
                    <button
                      onClick={() => onToggleLike(song)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Listening History / Recently Played Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <span>Listening History</span>
            </h3>
            <p className="text-xs text-zinc-400">Recently played tracks on your account</p>
          </div>

          {history && history.length > 0 && onClearHistory && (
            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history && history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((item, idx) => {
              const playCount = getSongListenCount(item.id, item.basePlays || 50000);
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="glass-card p-3 flex items-center justify-between gap-3 group hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>
                      <span className="text-[10px] text-cyan-300 font-medium flex items-center gap-1 mt-0.5">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>{formatListenCount(playCount)}</span>
                        {item.playedAt && <span className="text-zinc-500">• {item.playedAt}</span>}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onPlaySong(item)}
                    className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors flex-shrink-0"
                    title="Play Again"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs italic">
            <History className="w-8 h-8 text-zinc-600 mb-1" />
            <span>No listening history yet. Play any song from the Top 10 or Search!</span>
          </div>
        )}
      </div>
    </div>
  );
}
