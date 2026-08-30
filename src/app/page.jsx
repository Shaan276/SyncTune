'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PlayerFooter from '../components/PlayerFooter';
import CinemaPlayer from '../components/CinemaPlayer';
import FloatingWatchBtn from '../components/FloatingWatchBtn';
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
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Playback & Queue state
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.8);
  const [history, setHistory] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [artistRecommendations, setArtistRecommendations] = useState([]);
  const [genreRecommendations, setGenreRecommendations] = useState([]);
  const [autoplayMode, setAutoplayMode] = useState('taste'); // 'taste' (default) or 'artist'
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isCinemaOpen, setIsCinemaOpen] = useState(false);

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
        if (parsedHist.length > 0 && !currentSong) {
          setCurrentSong(parsedHist[0]);
        }
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

  const handleSetAutoplayMode = (mode) => {
    setAutoplayMode(mode);
    try {
      localStorage.setItem('synctune_autoplay_mode', mode);
    } catch (e) {}
  };

  // Fetch live YouTube recommendations for current song (Same Artist + Same Genre)
  useEffect(() => {
    if (!currentSong) return;
    let active = true;

    fetchLiveRecommendations(currentSong).then((recs) => {
      if (active) {
        // Enforce <10m filter on all incoming recommendation tracks
        const validArtist = (recs.artistTracks || []).filter((s) => (s.duration || 210) <= 600);
        const validGenre = (recs.genreTracks || []).filter((s) => (s.duration || 210) <= 600);
        setArtistRecommendations(validArtist);
        setGenreRecommendations(validGenre);
      }
    });

    return () => {
      active = false;
    };
  }, [currentSong?.id, currentSong?.artist]);

  // Sync dark/light theme class on document element
  useEffect(() => {
    if (!isDarkMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  const handleSearch = async (query, category) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = await searchYouTube(query, category);
    // Filter tracks <= 10m
    setSearchResults(results.filter((s) => (s.duration || 210) <= 600));
  };

  const handlePlaySong = useCallback((song) => {
    if (!song || !song.id) return;

    // Enforce 10-minute maximum duration limit
    if ((song.duration || 0) > 600) {
      alert("SyncTune is optimized for low data consumption tracks under 10 minutes.");
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

    const historyItem = {
      ...song,
      playedAtTimestamp: new Date().toISOString()
    };

    setHistory((prev) => {
      const filtered = prev.filter((s) => s.id !== song.id);
      const updated = [historyItem, ...filtered].slice(0, 50);
      try {
        localStorage.setItem('synctune_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (typeof window !== 'undefined' && window.syncTunePlayAudio) {
      window.syncTunePlayAudio(song.id);
    }
  }, []);

  const handleSkipNext = useCallback(() => {
    // 1. Next in User Queue
    if (queue.length > 0) {
      const nextSong = queue[0];
      const remainingQueue = queue.slice(1);
      setQueue(remainingQueue);
      try {
        localStorage.setItem('synctune_queue', JSON.stringify(remainingQueue));
      } catch (e) {}
      handlePlaySong(nextSong);
      return;
    }

    // 2. Next based on user's selected autoplayMode preference
    if (autoplayMode === 'artist') {
      if (artistRecommendations.length > 0) {
        handlePlaySong(artistRecommendations[0]);
        return;
      }
      if (genreRecommendations.length > 0) {
        handlePlaySong(genreRecommendations[0]);
        return;
      }
    } else {
      // 'taste' (default)
      if (genreRecommendations.length > 0) {
        handlePlaySong(genreRecommendations[0]);
        return;
      }
      if (artistRecommendations.length > 0) {
        handlePlaySong(artistRecommendations[0]);
        return;
      }
    }

    // 3. Fallback history loop
    if (history.length > 1 && currentSong) {
      const currentIndex = history.findIndex((s) => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % history.length;
      handlePlaySong(history[nextIndex]);
    }
  }, [queue, autoplayMode, artistRecommendations, genreRecommendations, history, currentSong, handlePlaySong]);

  const handleSkipPrev = useCallback(() => {
    if (history.length > 1 && currentSong) {
      const currentIndex = history.findIndex((s) => s.id === currentSong.id);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : history.length - 1;
      handlePlaySong(history[prevIndex]);
    }
  }, [history, currentSong, handlePlaySong]);

  const handleAddToQueue = useCallback((song) => {
    if (!song) return;
    if ((song.duration || 0) > 600) {
      alert("Only songs under 10 minutes can be added to queue.");
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
    } catch (e) {}
    setHistory([]);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.syncTunePlayAudio) {
        window.syncTunePlayAudio(currentSong?.id);
      }
      return next;
    });
  }, [currentSong?.id]);

  const handleSeek = useCallback((newTime) => {
    setCurrentTime(newTime);
    if (typeof window !== 'undefined' && window.syncTuneSeekAudio) {
      window.syncTuneSeekAudio(newTime);
    }
  }, []);

  const handleToggleLike = useCallback((song) => {
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] select-none">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        activeRoom={activeRoom}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          onSearch={handleSearch}
          activeRoom={activeRoom}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuthModal(true)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardView
              searchResults={searchResults}
              onPlaySong={handlePlaySong}
              onAddToQueue={handleAddToQueue}
              likedSongs={likedSongs}
              onToggleLike={handleToggleLike}
              history={history}
              onClearHistory={handleClearHistory}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomsView
              user={user}
              activeRoom={activeRoom}
              setActiveRoom={setActiveRoom}
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
        onToggleCinema={() => setIsCinemaOpen(!isCinemaOpen)}
        isCinemaOpen={isCinemaOpen}
        likedSongs={likedSongs}
        onToggleLike={handleToggleLike}
        queue={queue}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        isQueueOpen={isQueueOpen}
      />

      {/* Slide-out Queue Drawer */}
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
        artistRecommendations={artistRecommendations}
        genreRecommendations={genreRecommendations}
        autoplayMode={autoplayMode}
        setAutoplayMode={handleSetAutoplayMode}
      />

      {/* Floating Watch Together Cinema Launcher */}
      <FloatingWatchBtn
        isOpen={isCinemaOpen}
        onClick={() => setIsCinemaOpen(!isCinemaOpen)}
      />

      {/* Cinema Overlay View */}
      <CinemaPlayer
        isOpen={isCinemaOpen}
        onClose={() => setIsCinemaOpen(false)}
        currentSong={currentSong}
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

      {/* Live YouTube High Fidelity Ultra-Low Data Audio Engine */}
      <YouTubeAudioEngine
        currentSong={currentSong}
        isPlaying={isPlaying}
        volume={volume}
        onTimeUpdate={(time) => setCurrentTime(Math.floor(time))}
        onEnded={handleSkipNext}
      />
    </div>
  );
}
