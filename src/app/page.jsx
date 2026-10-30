'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PlayerFooter from '../components/PlayerFooter';
import LiveReactionOverlay from '../components/LiveReactionOverlay';
import AuthModal from '../components/AuthModal';
import YouTubeAudioEngine from '../components/YouTubeAudioEngine';
import QueueDrawer from '../components/QueueDrawer';

import DashboardView from '../components/views/DashboardView';
import RoomsView from '../components/views/RoomsView';
import PlaylistsView from '../components/views/PlaylistsView';
import FriendsView from '../components/views/FriendsView';
import AdminView from '../components/views/AdminView';

import { searchYouTube, recordSongPlay, fetchLiveRecommendations } from '../lib/youtube';

export default function Home() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeRoom, setActiveRoom] = useState(null);

  // Playback & Queue state
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(false);
  const [history, setHistory] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [artistRecommendations, setArtistRecommendations] = useState([]);
  const [genreRecommendations, setGenreRecommendations] = useState([]);
  const [autoplayMode, setAutoplayMode] = useState('taste'); // 'taste' (default) or 'artist'
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;
  const autoplayModeRef = useRef(autoplayMode);
  autoplayModeRef.current = autoplayMode;
  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;
  const userRef = useRef(user);
  userRef.current = user;

  // Hydrate user session, history & queue from localStorage
  useEffect(() => {
    setIsClient(true);
    try {
      const stored = localStorage.getItem('user');
      if (stored && stored !== 'undefined' && stored !== 'null') {
        setUser(JSON.parse(stored));
      } else {
        setShowAuthModal(true);
      }
    } catch (e) {
      setShowAuthModal(true);
    }

    try {
      const storedHistory = localStorage.getItem('synctune_history');
      if (storedHistory) {
        const parsedHist = JSON.parse(storedHistory);
        setHistory(parsedHist);
      }
      const storedLiked = localStorage.getItem('synctune_liked_songs');
      if (storedLiked) {
        setLikedSongs(JSON.parse(storedLiked));
      }
      const storedQueue = localStorage.getItem('synctune_queue');
      if (storedQueue) {
        setQueue(JSON.parse(storedQueue));
      }
      const storedAutoplayMode = localStorage.getItem('synctune_autoplay_mode');
      if (storedAutoplayMode) {
        setAutoplayMode(storedAutoplayMode);
      }
    } catch (e) {}
  }, []);

  // Hydrate persistent listened_history from database for the active user
  useEffect(() => {
    if (!user || !user.id) return;
    fetch(`/api/history?userId=${user.id}&email=${encodeURIComponent(user.email || '')}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.history) && d.history.length > 0) {
          setHistory(d.history);
          try {
            localStorage.setItem('synctune_history', JSON.stringify(d.history));
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleRefreshQueue = useCallback(async (overrideMode) => {
    const baseSong = currentSongRef.current;
    if (!baseSong) return;
    const mode = overrideMode || autoplayModeRef.current;
    try {
      const recs = await fetchLiveRecommendations(baseSong);
      const candidates = mode === 'artist'
        ? (recs.artistTracks || [])
        : (recs.genreTracks || []);

      const newTracks = candidates
        .filter((t) => t.id !== baseSong.id && (t.duration || 210) <= 600)
        .slice(0, 10);

      setQueue(newTracks);
      try {
        localStorage.setItem('synctune_queue', JSON.stringify(newTracks));
      } catch (e) {}
    } catch (err) {}
  }, []);

  const handleSetAutoplayMode = (mode) => {
    setAutoplayMode(mode);
    try {
      localStorage.setItem('synctune_autoplay_mode', mode);
    } catch (e) {}
    handleRefreshQueue(mode);
  };

  // Helper: Replenish queue to maintain exactly 10 upcoming tracks
  const replenishQueueToTarget = useCallback(async (baseSong, currentList, targetCount = 10) => {
    if (!baseSong) return;
    const currentQ = currentList || queueRef.current;
    const deficit = targetCount - currentQ.length;
    if (deficit <= 0) return;

    try {
      const recs = await fetchLiveRecommendations(baseSong);
      const candidates = autoplayModeRef.current === 'artist'
        ? (recs.artistTracks || [])
        : (recs.genreTracks || []);

      const existingIds = new Set([baseSong.id, ...currentQ.map(s => s.id)]);
      const newTracks = [];

      for (const track of candidates) {
        if (!existingIds.has(track.id) && (track.duration || 210) <= 600) {
          existingIds.add(track.id);
          newTracks.push(track);
          if (newTracks.length >= deficit) break;
        }
      }

      if (newTracks.length > 0) {
        setQueue((prev) => {
          const updated = [...prev, ...newTracks].slice(0, targetCount);
          try {
            localStorage.setItem('synctune_queue', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    } catch (err) {}
  }, []);

  // Fetch live YouTube recommendations for current song (Same Artist + Same Genre)
  useEffect(() => {
    if (!currentSong) return;
    let active = true;

    fetchLiveRecommendations(currentSong).then((recs) => {
      if (active) {
        const validArtist = (recs.artistTracks || []).filter((s) => (s.duration || 210) <= 600);
        const validGenre = (recs.genreTracks || []).filter((s) => (s.duration || 210) <= 600);
        setArtistRecommendations(validArtist);
        setGenreRecommendations(validGenre);

        // Auto-populate 10 upcoming songs if queue is sparse
        if (queueRef.current.length < 10) {
          replenishQueueToTarget(currentSong, queueRef.current, 10);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [currentSong?.id, replenishQueueToTarget]);

  const handleSearch = async (query, category) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = await searchYouTube(query, category);
    if (category === 'mix' || category === 'mixups') {
      setSearchResults(results);
    } else {
      setSearchResults(results.filter((s) => (s.duration || 210) <= 600));
    }
  };

  // Play a song & synchronize with room members
  const handlePlaySong = useCallback((song, isFromRoomSync = false, isGoingBack = false) => {
    if (!song || !song.id) return;

    const isMixup = (song.title && (song.title.toLowerCase().includes('mashup') || song.title.toLowerCase().includes('mix') || song.title.toLowerCase().includes('remix')));
    if (!isMixup && (song.duration || 0) > 600) {
      alert("SyncTune pure tracks are optimized for low data consumption under 10 minutes (Mixups & Mashups can be any length).");
      return;
    }

    const songToPlay = {
      ...song,
      playTrigger: Date.now()
    };

    setCurrentSong(songToPlay);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(song.duration || 210);

    recordSongPlay(song);

    // If active in a room and not triggered by incoming room sync, broadcast play to room!
    if (activeRoomRef.current && !isFromRoomSync) {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          code: activeRoomRef.current,
          song: songToPlay,
          currentTime: 0,
          user: userRef.current
        })
      }).catch(() => {});
    }

    const historyItem = {
      ...song,
      playedAtTimestamp: new Date().toISOString()
    };

    if (!isGoingBack) {
      setHistory((prev) => {
        const filtered = prev.filter((s) => s.id !== song.id);
        const updated = [historyItem, ...filtered].slice(0, 50);
        try {
          localStorage.setItem('synctune_history', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // Save to database listened_history for currently logged in user
      if (userRef.current) {
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userRef.current.id,
            email: userRef.current.email,
            song: historyItem
          })
        }).catch(() => {});
      }
    }

    if (typeof window !== 'undefined' && window.syncTunePlayAudio) {
      window.syncTunePlayAudio(song.id, song.audioUrl);
    }

    // Auto-buffer upcoming queue to 10 songs on song start
    replenishQueueToTarget(songToPlay, queueRef.current, 10);
  }, [replenishQueueToTarget]);

  // Global Real-Time Room Synchronizer (Synchronizes across all devices & tabs)
  useEffect(() => {
    if (!activeRoom) return;
    let isCancelled = false;

    const syncRoom = async () => {
      try {
        const res = await fetch(`/api/room?action=get&code=${encodeURIComponent(activeRoom)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data || !data.room) return;

        const roomSong = data.room.currentSong;
        const roomPlaying = Boolean(data.room.isPlaying);
        const roomTime = data.room.currentTime || 0;

        // 1. Synchronize Song Playback
        if (roomSong && roomSong.id) {
          if (!currentSongRef.current || currentSongRef.current.id !== roomSong.id) {
            handlePlaySong(roomSong, true);
          }
        }

        // 2. Synchronize Play / Pause State
        if (roomPlaying !== isPlayingRef.current) {
          setIsPlaying(roomPlaying);
          if (roomPlaying) {
            window.syncTunePlayAudio?.(roomSong?.id, roomSong?.audioUrl);
          }
        }

        // 3. Drift Correction (> 4 seconds drift)
        if (Math.abs(roomTime - currentTimeRef.current) > 4) {
          setCurrentTime(roomTime);
          window.syncTuneSeekAudio?.(roomTime);
        }
      } catch (err) {}
    };

    syncRoom();
    const interval = setInterval(syncRoom, 1200);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeRoom, handlePlaySong]);

  // Rolling Queue Skip Next: Pop 1, Play 1, Fetch 1 new vibe track to maintain 10 songs!
  const handleSkipNext = useCallback(() => {
    // 1. Loop Check: If loop song is ON, repeat the track
    if (isLoopingRef.current && currentSongRef.current) {
      setCurrentTime(0);
      if (typeof window !== 'undefined' && window.syncTuneSeekAudio) {
        window.syncTuneSeekAudio(0);
      }
      if (typeof window !== 'undefined' && window.syncTunePlayAudio) {
        window.syncTunePlayAudio(currentSongRef.current.id, currentSongRef.current.audioUrl);
      }
      return;
    }

    const currentQ = queueRef.current;

    // 2. Rolling 10-Song Queue:
    if (currentQ.length > 0) {
      const nextSong = currentQ[0];
      const remainingQueue = currentQ.slice(1); // 9 songs remain!

      handlePlaySong(nextSong);

      // Fetch 1 new track of the same vibe to append to the end, keeping buffer at 10!
      fetchLiveRecommendations(nextSong).then((recs) => {
        const pool = autoplayModeRef.current === 'artist'
          ? [...(recs.artistTracks || []), ...(recs.genreTracks || [])]
          : [...(recs.genreTracks || []), ...(recs.artistTracks || [])];

        const existingIds = new Set([nextSong.id, ...remainingQueue.map(s => s.id)]);
        const candidate = pool.find(s => !existingIds.has(s.id) && (s.duration || 210) <= 600) || pool[0];

        const updatedQueue = candidate ? [...remainingQueue, candidate] : remainingQueue;
        setQueue(updatedQueue);
        try {
          localStorage.setItem('synctune_queue', JSON.stringify(updatedQueue));
        } catch (e) {}
      }).catch(() => {
        setQueue(remainingQueue);
      });
      return;
    }

    // 3. Fallback if queue is empty
    if (currentSongRef.current) {
      fetchLiveRecommendations(currentSongRef.current).then((recs) => {
        const list = autoplayModeRef.current === 'artist'
          ? [...(recs.artistTracks || []), ...(recs.genreTracks || [])]
          : [...(recs.genreTracks || []), ...(recs.artistTracks || [])];
        const valid = list.filter(s => s.id !== currentSongRef.current?.id && (s.duration || 210) <= 600);
        if (valid.length > 0) {
          handlePlaySong(valid[0]);
          setQueue(valid.slice(1, 10));
        }
      });
    }
  }, [handlePlaySong]);

  const handleSkipPrev = useCallback(() => {
    if (!currentSong || history.length <= 1) return;
    const currentIndex = history.findIndex((s) => s.id === currentSong.id);
    let targetSong = null;
    if (currentIndex >= 0 && currentIndex + 1 < history.length) {
      targetSong = history[currentIndex + 1];
    } else if (currentIndex === -1 && history.length > 0) {
      targetSong = history[0];
    } else if (history.length > 1) {
      targetSong = history[1];
    }
    if (targetSong) {
      handlePlaySong(targetSong, false, true); // isGoingBack = true
    }
  }, [history, currentSong, handlePlaySong]);

  const handleAddToQueue = useCallback((song) => {
    if (!song) return;
    const isMixup = (song.title && (song.title.toLowerCase().includes('mashup') || song.title.toLowerCase().includes('mix')));
    if (!isMixup && (song.duration || 0) > 600) {
      alert("Only pure tracks under 10 minutes (or mixups) can be added to queue.");
      return;
    }

    setQueue((prev) => {
      const updated = [...prev, song];
      try {
        localStorage.setItem('synctune_queue', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const handleRemoveFromQueue = useCallback((index) => {
    setQueue((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem('synctune_queue', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const handleClearQueue = useCallback(() => {
    try {
      localStorage.removeItem('synctune_queue');
    } catch (e) {}
    setQueue([]);
  }, []);

  const handleClearHistory = useCallback(() => {
    try {
      localStorage.removeItem('synctune_history');
      localStorage.removeItem('synctune_play_counts');
      localStorage.removeItem('synctune_song_metadata');
    } catch (e) {}
    setHistory([]);
  }, []);

  const handleDirectPlay = useCallback(() => {
    setIsPlaying(true);
    if (typeof window !== 'undefined' && window.syncTunePlayAudio) {
      window.syncTunePlayAudio(currentSongRef.current?.id, currentSongRef.current?.audioUrl);
    }
    if (activeRoomRef.current) {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          code: activeRoomRef.current,
          currentTime: currentTimeRef.current,
          user: userRef.current
        })
      }).catch(() => {});
    }
  }, []);

  const handleDirectPause = useCallback(() => {
    setIsPlaying(false);
    if (activeRoomRef.current) {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          code: activeRoomRef.current,
          currentTime: currentTimeRef.current,
          user: userRef.current
        })
      }).catch(() => {});
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.syncTunePlayAudio) {
        window.syncTunePlayAudio(currentSongRef.current?.id, currentSongRef.current?.audioUrl);
      }
      // Broadcast to room
      if (activeRoomRef.current) {
        fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: next ? 'resume' : 'pause',
            code: activeRoomRef.current,
            currentTime: currentTimeRef.current,
            user: userRef.current
          })
        }).catch(() => {});
      }
      return next;
    });
  }, []);

  const handleSeek = useCallback((newTime) => {
    setCurrentTime(newTime);
    if (typeof window !== 'undefined' && window.syncTuneSeekAudio) {
      window.syncTuneSeekAudio(newTime);
    }
    // Broadcast seek to room
    if (activeRoomRef.current) {
      fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'seek',
          code: activeRoomRef.current,
          currentTime: newTime,
          user: userRef.current
        })
      }).catch(() => {});
    }
  }, []);

  const handleToggleLike = useCallback((song) => {
    if (!song || !song.id) return;
    setLikedSongs((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      const updated = exists ? prev.filter((s) => s.id !== song.id) : [song, ...prev];
      try {
        localStorage.setItem('synctune_liked_songs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setActiveTab('dashboard');
    setActiveRoom(null);
    setIsPlaying(false);
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setShowAuthModal(false);
  };

  const handleQuickCreateRoom = useCallback(async () => {
    setActiveTab('rooms');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          user: userRef.current,
          isPrivate: false
        })
      });
      const data = await res.json().catch(() => null);
      if (data && data.room) {
        setActiveRoom(data.room.code);
      }
    } catch (e) {}
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080C14] text-[#F8FAFC] select-none">
      {/* Modern Sidebar with Mobile Drawer support */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        activeRoom={activeRoom}
        onCreateRoomQuick={handleQuickCreateRoom}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#080C14]">
        <Header
          user={user}
          activeRoom={activeRoom}
          activeTab={activeTab}
          onCreateRoomQuick={handleQuickCreateRoom}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuthModal(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              searchResults={searchResults}
              onSearch={handleSearch}
              onPlaySong={handlePlaySong}
              onAddToQueue={handleAddToQueue}
              likedSongs={likedSongs}
              onToggleLike={handleToggleLike}
              history={history}
              onClearHistory={handleClearHistory}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomsView
              user={user}
              activeRoom={activeRoom}
              setActiveRoom={setActiveRoom}
              currentSong={currentSong}
              onPlaySong={handlePlaySong}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistsView
              likedSongs={likedSongs}
              onPlaySong={handlePlaySong}
              onToggleLike={handleToggleLike}
            />
          )}

          {activeTab === 'friends' && (
            <FriendsView
              user={user}
              setActiveRoom={setActiveRoom}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'admin' && user?.role === 'admin' && (
            <AdminView
              user={user}
              activeRoom={activeRoom}
              setActiveRoom={setActiveRoom}
            />
          )}
        </main>
      </div>

      {/* Global Bottom Audio Player */}
      <PlayerFooter
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onTogglePlay={handleTogglePlay}
        onPlayPause={handleTogglePlay}
        onSkipNext={handleSkipNext}
        onSkipPrev={handleSkipPrev}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
        likedSongs={likedSongs}
        onToggleLike={handleToggleLike}
        history={history}
        queue={queue}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        isQueueOpen={isQueueOpen}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
      />

      {/* Slide-out Queue Drawer with Top Autoplay Preference */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        currentSong={currentSong}
        queue={queue}
        onPlaySong={(song, index) => {
          if (index !== undefined) {
            handleRemoveFromQueue(index);
          }
          handlePlaySong(song);
        }}
        onAddToQueue={handleAddToQueue}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onRefreshQueue={handleRefreshQueue}
        autoplayMode={autoplayMode}
        setAutoplayMode={handleSetAutoplayMode}
      />

      {/* Real-time Emoji Reaction Overlay */}
      <LiveReactionOverlay roomCode={activeRoom} />

      {/* Sign In & Create New ID Modal */}
      {showAuthModal && (
        <AuthModal
          onLogin={handleLoginSuccess}
          onClose={() => setShowAuthModal(false)}
          allowClose={Boolean(user)}
        />
      )}

      {/* Live YouTube High Fidelity Ultra-Low Data Audio Engine with Mobile Background Playback */}
      <YouTubeAudioEngine
        currentSong={currentSong}
        isPlaying={isPlaying}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={(time) => setCurrentTime(Math.floor(time))}
        onEnded={handleSkipNext}
        onPlay={handleDirectPlay}
        onPause={handleDirectPause}
        onTogglePlay={handleTogglePlay}
        onSkipNext={handleSkipNext}
        onSkipPrev={handleSkipPrev}
        onSeek={handleSeek}
      />
    </div>
  );
}
