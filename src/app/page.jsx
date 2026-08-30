'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PlayerFooter from '../components/PlayerFooter';
import CinemaPlayer from '../components/CinemaPlayer';
import FloatingWatchBtn from '../components/FloatingWatchBtn';
import LiveReactionOverlay from '../components/LiveReactionOverlay';
import AuthModal from '../components/AuthModal';
import YouTubeAudioEngine from '../components/YouTubeAudioEngine';

import DashboardView from '../components/views/DashboardView';
import RoomsView from '../components/views/RoomsView';
import PlaylistsView from '../components/views/PlaylistsView';
import FriendsView from '../components/views/FriendsView';
import AdminView from '../components/views/AdminView';

import { searchYouTube, TOP_RECOMMENDED_SONGS, recordSongPlay } from '../lib/youtube';

export default function Home() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeRoom, setActiveRoom] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Playback state
  const [currentSong, setCurrentSong] = useState(TOP_RECOMMENDED_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(260);
  const [volume, setVolume] = useState(0.8);
  const [history, setHistory] = useState([]);
  const [likedSongs, setLikedSongs] = useState([TOP_RECOMMENDED_SONGS[0]]);
  const [searchResults, setSearchResults] = useState([]);
  const [isCinemaOpen, setIsCinemaOpen] = useState(false);

  // Hydrate user session & history from localStorage
  useEffect(() => {
    setIsClient(true);
    try {
      const stored = localStorage.getItem('user');
      if (stored && stored !== 'undefined' && stored !== 'null') {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } else {
        setShowAuthModal(true);
      }
    } catch (e) {
      setShowAuthModal(true);
    }

    try {
      const storedHistory = localStorage.getItem('synctune_history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {}
  }, []);

  // Sync dark/light theme class on document element
  useEffect(() => {
    if (!isDarkMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  // Audio timer simulation / sync
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= (duration || 240)) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration]);

  const handleSearch = async (query, category) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = await searchYouTube(query, category);
    setSearchResults(results);
  };

  const handlePlaySong = (song) => {
    if (!song) return;
    setCurrentSong(song);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(song.duration || 210);

    // Increment play count
    recordSongPlay(song.id);

    // Record to listening history with timestamp
    const historyItem = {
      ...song,
      playedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setHistory((prev) => {
      const filtered = prev.filter((s) => s.id !== song.id);
      const updated = [historyItem, ...filtered].slice(0, 50); // Cap at 50 songs
      try {
        localStorage.setItem('synctune_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Explicit audio play invocation on user gesture
    if (typeof window !== 'undefined' && window.syncTunePlayAudio) {
      window.syncTunePlayAudio();
    }
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('synctune_history');
    } catch (e) {}
    setHistory([]);
  };

  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (nextState && typeof window !== 'undefined' && window.syncTunePlayAudio) {
      window.syncTunePlayAudio();
    }
  };

  const handleSeek = (newTime) => {
    setCurrentTime(newTime);
  };

  const handleAddToQueue = (song) => {
    handlePlaySong(song);
  };

  const handleToggleLike = (song) => {
    setLikedSongs((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) return prev.filter((s) => s.id !== song.id);
      return [song, ...prev];
    });
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
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
        onSeek={handleSeek}
        onVolumeChange={setVolume}
        onToggleCinema={() => setIsCinemaOpen(!isCinemaOpen)}
        isCinemaOpen={isCinemaOpen}
        likedSongs={likedSongs}
        onToggleLike={handleToggleLike}
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

      {/* Live YouTube High Fidelity Audio Engine */}
      <YouTubeAudioEngine
        currentSong={currentSong}
        isPlaying={isPlaying}
        volume={volume}
        onTimeUpdate={(time) => setCurrentTime(Math.floor(time))}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
}
