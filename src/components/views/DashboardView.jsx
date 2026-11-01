'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Plus, Heart, Music, Sparkles, Flame, History, Trash2, Compass, Radio, Search, Zap, Clock, ShieldCheck, ArrowRight, RotateCw } from 'lucide-react';
import { getUserRecommendations, formatPlayMultiplier, formatFullDateTime, getSongListenCount, formatTime, fetchLiveRecommendations } from '../../lib/youtube';

export default function DashboardView({
  user,
  searchResults = [],
  onSearch,
  onPlaySong,
  onAddToQueue,
  likedSongs = [],
  onToggleLike,
  history = [],
  onClearHistory,
  onNavigateTab
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('music');
  const [subTab, setSubTab] = useState('flow'); // 'flow', 'rooms', 'discover'
  const searchInputRef = useRef(null);

  // Dynamic recommendation refresh: mixes familiar favorites with brand new vibe tracks
  const refreshRecommendations = useCallback(async (forceRefresh = false) => {
    setIsRefreshingRecs(true);
    try {
      if (!history || history.length === 0) {
        setRecommendations([]);
        return;
      }

      // 1. Get most played favorite songs from history
      const userFavorites = getUserRecommendations(history);
      const historyIds = new Set(history.map((s) => s.id));

      // 2. Pick 3-4 familiar songs from favorites (shuffled for freshness on every refresh)
      const shuffledFavorites = [...userFavorites].sort(() => Math.random() - 0.5);
      const familiarTracks = shuffledFavorites.slice(0, 4).map((s) => ({ ...s, isNew: false }));

      // 3. Sample 1-2 seed songs from history to discover fresh new music
      const sampleSeeds = [];
      if (history.length > 0) {
        const randIdx = Math.floor(Math.random() * Math.min(5, history.length));
        sampleSeeds.push(history[randIdx]);
        if (history.length > 2) {
          const randIdx2 = Math.floor(Math.random() * history.length);
          if (randIdx2 !== randIdx) sampleSeeds.push(history[randIdx2]);
        }
      }

      let newCandidates = [];
      for (const seed of sampleSeeds) {
        if (!seed || !seed.title) continue;
        const recs = await fetchLiveRecommendations(seed, forceRefresh);
        const candidates = [...(recs.genreTracks || []), ...(recs.artistTracks || [])]
          .filter((t) => !historyIds.has(t.id) && (t.duration || 210) <= 600);
        newCandidates.push(...candidates);
      }

      // Deduplicate new discoveries
      const seenNew = new Set();
      const uniqueNew = [];
      for (const t of newCandidates) {
        if (!seenNew.has(t.id) && !historyIds.has(t.id)) {
          seenNew.add(t.id);
          uniqueNew.push({ ...t, isNew: true });
        }
      }

      // Shuffle new discoveries
      uniqueNew.sort(() => Math.random() - 0.5);
      const selectedNew = uniqueNew.slice(0, 6);

      // Interleave familiar and new tracks (e.g. New, New, Familiar, New, New, Familiar)
      const combined = [];
      let fi = 0, ni = 0;
      while (combined.length < 10 && (fi < familiarTracks.length || ni < selectedNew.length)) {
        if (ni < selectedNew.length) combined.push(selectedNew[ni++]);
        if (ni < selectedNew.length) combined.push(selectedNew[ni++]);
        if (fi < familiarTracks.length) combined.push(familiarTracks[fi++]);
      }

      // If we don't have enough new discoveries, fill remaining slots with other user favorites
      for (const fav of shuffledFavorites) {
        if (!combined.some((s) => s.id === fav.id)) {
          combined.push({ ...fav, isNew: false });
        }
        if (combined.length >= 10) break;
      }

      setRecommendations(combined);
    } catch (err) {
      console.error('Refresh recommendations error:', err);
    } finally {
      setIsRefreshingRecs(false);
    }
  }, [history]);

  useEffect(() => {
    refreshRecommendations(false);
  }, [refreshRecommendations]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim(), activeCategory);
    }
  };

  const displayName = user?.username || 'Listener';
  const totalSongsListened = history.length;
  const estimatedSavedMB = (totalSongsListened * 8.5).toFixed(1);
  const dataSavedPercent = Math.min(100, Math.round((parseFloat(estimatedSavedMB) / 500) * 100));
  const songsPlayedPercent = Math.min(100, Math.round((totalSongsListened / 25) * 100));
  const listeningTimeMinutes = Math.round(totalSongsListened * 3.5);
  const listeningTimePercent = Math.min(100, Math.round((listeningTimeMinutes / 120) * 100));

  return (
    <div className="flex flex-col gap-6 pb-32">
      {/* 1. Top Announcement Banner */}
      <div className="p-4 px-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

      {/* 2. Welcome Hero Card */}
      <div className="p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-1.5 min-w-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              LIVE DASHBOARD • DAILY OVERVIEW
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
            Welcome back, {displayName}!
          </h1>

          <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
            <span>Streamed <strong className="text-emerald-400 font-mono">{totalSongsListened}</strong> tracks</span>
            <span>•</span>
            <span>Listened <strong className="text-emerald-400 font-mono">{listeningTimeMinutes} min</strong></span>
            <span>•</span>
            <span className="text-zinc-500">Pure 144p audio streaming</span>
          </p>
        </div>
      </div>

      {/* 3. Real 2-Metrics Cards Grid (Songs Played & Minutes Listened) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Metric 1: Songs Played */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Music className="w-3.5 h-3.5" />
              <span>SONGS PLAYED</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">
              {songsPlayedPercent}%
            </span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              {totalSongsListened} <span className="text-xs text-zinc-500 font-normal">/ 25 daily</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${songsPlayedPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 2: Listening Time (Minutes Listened) */}
        <div className="p-4 rounded-xl bg-[#0F1626] border border-white/5 flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              <span>MINUTES LISTENED</span>
            </span>
            <span className="text-xs font-bold text-zinc-400 font-mono">
              {listeningTimePercent}%
            </span>
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">
              {listeningTimeMinutes} <span className="text-xs text-zinc-500 font-normal">/ 120 min</span>
            </div>
            <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${listeningTimePercent}%` }}
              />
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
          <span className="text-[11px] text-zinc-500 font-mono">
            {activeCategory === 'mix' ? 'Mixups (Any Length)' : 'Pure Music (<10m)'}
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#080C14] border border-white/10 hover:border-white/20 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all cursor-text"
          >
            <Search className="w-4 h-4 text-zinc-500 shrink-0 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by song name, artist (e.g. Vaaste, Arijit Singh, Shubh)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-zinc-500 py-0.5 cursor-text"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setActiveCategory('music'); if (onSearch && searchQuery) onSearch(searchQuery, 'music'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'mix'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              🔀 Mashups & Mixes
            </button>

            {/* Admin Only Devotional Category */}
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => { setActiveCategory('bhajan'); if (onSearch && searchQuery) onSearch(searchQuery, 'bhajan'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'bhajan'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                🕉️ Bhajan / Satsang
              </button>
            )}
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
                  className="p-3 rounded-xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-2 group min-w-0"
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
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                    </div>

                    {onToggleLike && (
                      <button
                        onClick={() => onToggleLike(song)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                        }`}
                        title={isLiked ? "Unlike" : "Like"}
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

      {/* 6. Personalized Recommended For You Section (Pure Real History, 0 Fake Data) */}
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
                : `Fresh mix based on your previous listening`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshRecommendations(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
              title="Refresh recommendations with new songs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshingRecs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {recommendations.length > 0 && (
              <span className="text-[10px] text-emerald-300 font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono">
                {recommendations.length} Tracks
              </span>
            )}
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {recommendations.map((song, index) => {
              const isLiked = likedSongs && likedSongs.some((s) => s.id === song.id);
              const rank = index + 1;

              return (
                <div
                  key={song.id}
                  className="p-3 rounded-xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-2 group relative min-w-0"
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
                      {song.isNew ? (
                        <span className="text-emerald-400 font-black">NEW</span>
                      ) : (
                        <>
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{formatPlayMultiplier(song.playCount || 1)}</span>
                        </>
                      )}
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
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                    </div>

                    {onToggleLike && (
                      <button
                        onClick={() => onToggleLike(song)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-500 hover:text-white'
                        }`}
                        title={isLiked ? "Unlike" : "Like"}
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
                  className="p-2.5 px-4 rounded-xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-4 hover:border-emerald-500/30 transition-all min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                      loading="lazy"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>
                    </div>
                  </div>

                  <div className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-black text-xs font-mono shrink-0">
                    {formatPlayMultiplier(playCount || 1)}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span suppressHydrationWarning className="text-[11px] text-zinc-500 font-mono hidden md:inline-block">
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
