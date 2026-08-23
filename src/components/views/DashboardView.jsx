'use client';
import React from 'react';
import { Play, Plus, Heart, Music, Sparkles } from 'lucide-react';
import { DEFAULT_POPULAR_SONGS } from '../lib/youtube';

export default function DashboardView({ searchResults, onPlaySong, onAddToQueue, likedSongs, onToggleLike }) {
  const displaySongs = searchResults && searchResults.length > 0 ? searchResults : DEFAULT_POPULAR_SONGS;

  return (
    <div className="flex flex-col gap-6 pb-28">
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
          Listen to your favorite music and watch videos in real-time with friends. Synchronized rooms, live reaction emojis, and ultra-low data streaming.
        </p>
      </div>

      {/* Track Grid Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" />
            <span>{searchResults && searchResults.length > 0 ? 'Search Results' : 'Featured Tracks'}</span>
          </h3>
          <span className="text-xs text-zinc-400 font-mono">{displaySongs.length} tracks available</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displaySongs.map((song) => {
            const isLiked = likedSongs && likedSongs.some(s => s.id === song.id);
            return (
              <div
                key={song.id}
                className="glass-card p-4 flex flex-col gap-3 group hover:border-purple-500/40 transition-all cursor-pointer"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                  <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  
                  {/* Hover Overlay Play Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <button
                      onClick={() => onPlaySong(song)}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                      title="Play Now"
                    >
                      <Play className="w-4 h-4 ml-0.5" />
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
                        isLiked ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-white'
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
    </div>
  );
}
