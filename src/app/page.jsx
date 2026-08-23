'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PlayerFooter from '../components/PlayerFooter';
import CinemaPlayer from '../components/CinemaPlayer';
import FloatingWatchBtn from '../components/FloatingWatchBtn';
import LiveReactionOverlay from '../components/LiveReactionOverlay';

import DashboardView from '../components/views/DashboardView';
import RoomsView from '../components/views/RoomsView';
import PlaylistsView from '../components/views/PlaylistsView';
import FriendsView from '../components/views/FriendsView';
import AdminView from '../components/views/AdminView';

import { searchYouTube, DEFAULT_POPULAR_SONGS } from '../lib/youtube';

export default function Home() {
  const [user, setUser] = useState({
    id: 1,
    username: 'Piyush',
    email: 'piyushpilkhwal74@gmail.com',
    role: 'admin'
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeRoom, setActiveRoom] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Playback state
  const [currentSong, setCurrentSong] = useState(DEFAULT_POPULAR_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(160);
  const [volume, setVolume] = useState(0.8);
  const [history, setHistory] = useState([DEFAULT_POPULAR_SONGS[0]]);
  const [likedSongs, setLikedSongs] = useState([DEFAULT_POPULAR_SONGS[0]]);
  const [searchResults, setSearchResults] = useState([]);
  const [isCinemaOpen, setIsCinemaOpen] = useState(false);

  // Sync dark/light theme class on document element
  useEffect(() => {
    if (!isDarkMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  // Audio timer simulation
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= (duration || 160)) {
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
    setCurrentSong(song);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(song.duration || 180);
    setHistory((prev) => [song, ...prev.filter((s) => s.id !== song.id)].slice(0, 50));
  };

  const handleAddToQueue = (song) => {
    alert(`Added "${song.title}" to queue!`);
  };

  const handleToggleLike = (song) => {
    setLikedSongs((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) return prev.filter((s) => s.id !== song.id);
      return [song, ...prev];
    });
  };

  const handleSkipNext = () => {
    if (DEFAULT_POPULAR_SONGS.length > 0) {
      const nextSong = DEFAULT_POPULAR_SONGS[(DEFAULT_POPULAR_SONGS.indexOf(currentSong) + 1) % DEFAULT_POPULAR_SONGS.length];
      handlePlaySong(nextSong);
    }
  };

  const handleSkipPrev = () => {
    if (history.length > 1) {
      const prevSong = history[1];
      handlePlaySong(prevSong);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        activeRoom={activeRoom}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 pr-6">
        <Header
          user={user}
          onSearch={handleSearch}
          activeRoom={activeRoom}
          onLogout={() => setUser(null)}
        />

        <div className="flex-1 px-2 pt-2">
          {activeTab === 'dashboard' && (
            <DashboardView
              searchResults={searchResults}
              onPlaySong={handlePlaySong}
              onAddToQueue={handleAddToQueue}
              likedSongs={likedSongs}
              onToggleLike={handleToggleLike}
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
              activeRoom={activeRoom}
              setActiveRoom={setActiveRoom}
            />
          )}

          {activeTab === 'admin' && (
            <AdminView
              user={user}
              setActiveRoom={setActiveRoom}
            />
          )}
        </div>
      </main>

      {/* Watch Together Cinema Player */}
      <CinemaPlayer
        isOpen={isCinemaOpen}
        onClose={() => setIsCinemaOpen(false)}
        currentSong={currentSong}
        isRoom={!!activeRoom}
      />

      {/* Floating Cinema Button */}
      <FloatingWatchBtn
        onClick={() => setIsCinemaOpen(!isCinemaOpen)}
        isRoom={!!activeRoom}
        isOpen={isCinemaOpen}
      />

      {/* Live Room Emoji Reaction Overlay */}
      <LiveReactionOverlay activeRoom={activeRoom} />

      {/* Audio Player Footer */}
      <PlayerFooter
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onSkipNext={handleSkipNext}
        onSkipPrev={handleSkipPrev}
        currentTime={currentTime}
        duration={duration}
        onSeek={(t) => setCurrentTime(t)}
        volume={volume}
        onVolumeChange={(v) => setVolume(v)}
        history={history}
        likedSongs={likedSongs}
        onToggleLike={handleToggleLike}
        onToggleCinema={() => setIsCinemaOpen(!isCinemaOpen)}
      />
    </div>
  );
}
