'use client';
import React, { useState } from 'react';
import { Music2, Plus, Play, Heart, Trash2, FolderPlus, X, Disc } from 'lucide-react';

export default function PlaylistsView({ likedSongs, onPlaySong, onToggleLike }) {
  const [playlists, setPlaylists] = useState([
    { id: 1, name: 'Liked Songs', count: likedSongs ? likedSongs.length : 1, songs: likedSongs || [{ id: "hT_nvWreIhg", title: "One Love", artist: "Shubh", duration: 160, thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg" }] },
    { id: 2, name: 'Late Night Chill', count: 2, songs: [{ id: "vJQMv7A_N30", title: "Cheques", artist: "Shubh", duration: 184, thumbnail: "https://i.ytimg.com/vi/vJQMv7A_N30/hqdefault.jpg" }] }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');

  const handleCreatePlaylistSubmit = (e) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    const newPl = {
      id: Date.now(),
      name: playlistName.trim(),
      description: playlistDescription.trim() || 'Custom SyncTune playlist',
      count: 0,
      songs: []
    };

    setPlaylists((prev) => [newPl, ...prev]);
    setShowCreateModal(false);
    setPlaylistName('');
    setPlaylistDescription('');
  };

  const handleDeletePlaylist = (id) => {
    if (confirm('Delete this playlist?')) {
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white text-glow-purple flex items-center gap-2">
            <Music2 className="w-6 h-6 text-purple-400" />
            <span>Playlists & Collections</span>
          </h2>
          <p className="text-xs text-zinc-400">Manage custom music playlists and saved tracks</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Playlists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((pl) => (
          <div key={pl.id} className="glass-panel p-5 flex flex-col gap-4 group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                  <Disc className="w-5 h-5 text-purple-400 group-hover:rotate-45 transition-transform" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{pl.name}</h3>
                  <p className="text-[10px] text-zinc-400">{pl.description || `${pl.songs.length} tracks`}</p>
                </div>
              </div>

              {pl.id !== 1 && (
                <button
                  onClick={() => handleDeletePlaylist(pl.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete Playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 min-h-[100px]">
              {pl.songs && pl.songs.length > 0 ? (
                pl.songs.map((song) => (
                  <div key={song.id} className="glass-card p-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {song.thumbnail && (
                        <img src={song.thumbnail} alt={song.title} className="w-8 h-8 rounded-lg object-cover" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white truncate">{song.title}</span>
                        <span className="text-[10px] text-zinc-400 truncate">{song.artist}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onPlaySong(song)}
                      className="p-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                      title="Play Track"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 text-xs py-8 italic my-auto">
                  No tracks in this playlist yet. Add songs from Search!
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sleek Custom Glassmorphic Modal for Playlist Creation */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-md flex flex-col gap-5 border border-purple-500/30 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Create Custom Playlist</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylistSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-300">Playlist Title</label>
                <input
                  type="text"
                  placeholder="e.g., Summer Favorites, Roadtrip Mix..."
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-300">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short description of your playlist..."
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-xs font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/30"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
