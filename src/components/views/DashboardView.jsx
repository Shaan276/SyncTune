'use client';
import React, { useState, useEffect } from 'react';
import { Play, Plus, Heart, Music, Sparkles, Flame, History, Trash2, Compass, Radio, Search, Zap, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { getUserRecommendations, formatPlayMultiplier, formatFullDateTime, getSongListenCount, formatTime } from '../../lib/youtube';

export default function DashboardView({
  user,
  searchResults,
  onSearch,
  onPlaySong,
  onAddToQueue,
  likedSongs,
  onToggleLike,
  history = [],
  onClearHistory,
  onNavigateTab
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('music');
  const [subTab, setSubTab] = useState('flow'); // 'flow', 'rooms', 'discover'

  useEffect(() => {
    setRecommendations(getUserRecommendations());
  }, [history]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery, activeCategory);
    }
  };

  const displayName = user?.username || 'Piyush Pilkhwal';
  const totalSongsListened = history.length;
  const estimatedSavedMB = Math.max(12, totalSongsListened * 8.5);

  return (
    <div className="flex flex-col gap-6 pb-32">
      {/* 1. Top Announcement Banner (Matching Nutri-Track 'AI Health Assessment In Progress') */}
      <div className="p-4 px-5 rounded-2xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="text-xs font-bold text-white tracking-wide truncate">
              AI Music Matching & Synchronous Engine Ready
            </h4>
            <p className="text-[11px] text-zinc-400 truncate">
              Stream ultra-low data tracks with live room synchronization and zero video bandwidth overhead.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab && onNavigateTab('rooms')}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <span>Explore Rooms</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Welcome Hero Card (Matching Nutri-Track 'Welcome back, Piyush Pilkhwal!') */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LIVE DASHBOARD • DAILY OVERVIEW</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Welcome back, {displayName}!
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Streamed <strong className="text-emerald-400 font-bold">{totalSongsListened} tracks</strong> • Saved{' '}
            <strong className="text-cyan-400 font-bold">~{Math.round(estimatedSavedMB)} MB data</strong> •{' '}
            <strong className="text-purple-400 font-bold">3 live rooms</strong> active today.
          </p>
        </div>

        {/* Action Switcher Buttons (Matching Nutrition / Hydration / Activities) */}
        <div className="flex items-center gap-2 z-10 shrink-0">
          <button
            onClick={() => setSubTab('flow')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'flow'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-[#141C30] text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Solo Flow</span>
          </button>

          <button
            onClick={() => onNavigateTab && onNavigateTab('rooms')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'rooms'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-[#141C30] text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Rooms</span>
          </button>

          <button
            onClick={() => setSubTab('discover')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'discover'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-[#141C30] text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>
        </div>
      </div>

      {/* 3. 4-Metrics Cards Grid (Matching Nutri-Track Calories / Protein / Carbs / Fat) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Data Saved */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5" />
              <span>DATA SAVED</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">96%</span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              {Math.round(estimatedSavedMB)} <span className="text-xs text-zinc-500 font-normal">/ 500 MB</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '96%' }} />
            </div>
          </div>
        </div>

        {/* Metric 2: Songs Played */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Music className="w-3.5 h-3.5" />
              <span>SONGS PLAYED</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">
              {Math.min(100, Math.round((totalSongsListened / 25) * 100))}%
            </span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              {totalSongsListened} <span className="text-xs text-zinc-500 font-normal">/ 25 daily</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, Math.round((totalSongsListened / 25) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Listening Time */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              <span>LISTENING TIME</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">
              {Math.min(100, Math.round((totalSongsListened * 3.5 / 120) * 100))}%
            </span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              {Math.round(totalSongsListened * 3.5)} <span className="text-xs text-zinc-500 font-normal">/ 120 min</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${Math.min(100, Math.round((totalSongsListened * 3.5 / 120) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 4: Audio Fidelity */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>FIDELITY STREAM</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">144p Pure Audio</span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              1.0 <span className="text-xs text-zinc-500 font-normal">MB / track avg</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Integrated Search Bar & Category Filters */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Search & Play Any YouTube Track</span>
          </h3>
          <span className="text-[11px] text-zinc-500 font-mono">Max 10-Minute Pure Audio</span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/50 transition-all">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by song name, artist (e.g. Shubh, Billie Eilish, Karan Aujla)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveCategory('music'); if (onSearch && searchQuery) onSearch(searchQuery, 'music'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'music'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              🎵 Pure Tracks (&lt;10m)
            </button>
            <button
              type="button"
              onClick={() => { setActiveCategory('artist'); if (onSearch && searchQuery) onSearch(searchQuery, 'artist'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'artist'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              👨‍🎤 Artist Hits
            </button>
            <button
              type="button"
              onClick={() => { setActiveCategory('mix'); if (onSearch && searchQuery) onSearch(searchQuery, 'mix'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'mix'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              🔀 Mashups & Mixes
            </button>
          </div>
        </form>
      </div>

      {/* 5. Search Results Section */}
      {searchResults && searchResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-400" />
              <span>Search Results ({searchResults.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {searchResults.map((song) => {
              const isLiked = likedSongs && likedSongs.some((s) => s.id === song.id);
              const playCount = getSongListenCount(song.id);

              return (
                <div
                  key={song.id}
                  className="p-3 rounded-xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-2 group"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {playCount > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>{formatPlayMultiplier(playCount)}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        onClick={() => onPlaySong(song)}
                        className="w-9 h-9 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer font-bold"
                        title="Play Track"
                      >
                        <Play className="w-4 h-4 ml-0.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onAddToQueue(song)}
                        className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all cursor-pointer"
                        title="Add to Queue"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
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

      {/* 6. Personalized Recommended For You Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Recommended For You</span>
            </h3>
            <p className="text-xs text-zinc-500">
              {recommendations.length === 0
                ? 'Personalized from your listened songs'
                : `Top ${recommendations.length} most frequently played tracks`}
            </p>
          </div>

          {recommendations.length > 0 && (
            <span className="text-[10px] text-emerald-300 font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono">
              {recommendations.length} Tracks
            </span>
          )}
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {recommendations.map((song, index) => {
              const isLiked = likedSongs && likedSongs.some((s) => s.id === song.id);
              const rank = index + 1;

              return (
                <div
                  key={song.id}
                  className="p-3 rounded-xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-2 group relative"
                >
                  <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] ${
                    rank === 1 ? 'bg-amber-400 text-black' :
                    rank === 2 ? 'bg-zinc-300 text-black' :
                    rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-black/80 text-zinc-300'
                  }`}>
                    #{rank}
                  </div>

                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>{formatPlayMultiplier(song.playCount || 1)}</span>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        onClick={() => onPlaySong(song)}
                        className="w-9 h-9 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer font-bold"
                        title="Play Track"
                      >
                        <Play className="w-4 h-4 ml-0.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onAddToQueue(song)}
                        className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all cursor-pointer"
                        title="Add to Queue"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
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
        ) : (
          <div className="p-8 rounded-2xl bg-[#0F1626] border border-white/5 text-center flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
            <Compass className="w-7 h-7 text-emerald-400 animate-pulse mb-1" />
            <span className="font-bold text-white">No personal recommendations yet</span>
            <span className="text-zinc-500 max-w-sm">
              Search and play tracks above to build your personalized top tracks automatically!
            </span>
          </div>
        )}
      </div>

      {/* 7. Listening History Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Listening History</span>
            </h3>
            <p className="text-xs text-zinc-500">Chronological history with exact multipliers & dates</p>
          </div>

          {history && history.length > 0 && onClearHistory && (
            <button
              onClick={onClearHistory}
              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history && history.length > 0 ? (
          <div className="flex flex-col gap-2">
            {history.map((item, idx) => {
              const playCount = getSongListenCount(item.id);

              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-2.5 px-4 rounded-xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-4 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                      loading="lazy"
                    />
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs font-bold text-white truncate hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>
                    </div>
                  </div>

                  <div className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-black text-xs font-mono">
                    {formatPlayMultiplier(playCount || 1)}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline-block">
                      {formatFullDateTime(item.playedAtTimestamp || item.playedAt)}
                    </span>

                    <button
                      onClick={() => onPlaySong(item)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                      title="Play Track"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-[#0F1626] border border-white/5 text-center text-zinc-500 text-xs italic">
            No songs played in this session yet.
          </div>
        )}
      </div>
    </div>
  );
}
