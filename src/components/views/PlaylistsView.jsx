'use client';
import React, { useState } from 'react';
import { Music2, Plus, Play, Heart, Trash2, FolderPlus, X, Disc } from 'lucide-react';
import { formatTime } from '../../lib/youtube';

export default function PlaylistsView({ likedSongs = [], onPlaySong, onToggleLike }) {
  const [customPlaylists, setCustomPlaylists] = useState([]);
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
      songs: []
    };

    setCustomPlaylists((prev) => [newPl, ...prev]);
    setShowCreateModal(false);
    setPlaylistName('');
    setPlaylistDescription('');
  };

  const handleDeletePlaylist = (id) => {
    if (confirm('Delete this playlist?')) {
      setCustomPlaylists((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Music2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide">Playlists & Collections</h2>
            <p className="text-xs text-zinc-400">Manage custom music playlists and saved tracks</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>+ New Playlist</span>
        </button>
      </div>

      {/* Primary Saved Collection: Liked Songs */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center font-bold">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Liked Songs</h3>
              <p className="text-[10px] text-zinc-400">{likedSongs.length} saved {likedSongs.length === 1 ? 'track' : 'tracks'}</p>
            </div>
          </div>
        </div>

        {likedSongs && likedSongs.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {likedSongs.map((song) => (
              <div
                key={song.id}
                className="p-2.5 px-3 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-3 hover:border-emerald-500/30 transition-all min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-white truncate">{song.title}</span>
                    <span className="text-[10px] text-zinc-400 truncate">{song.artist} • {formatTime(song.duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onPlaySong && onPlaySong(song)}
                    className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                    title="Play Track"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                  {onToggleLike && (
                    <button
                      onClick={() => onToggleLike(song)}
                      className="p-2 rounded-lg text-pink-500 hover:bg-pink-500/10 transition-colors cursor-pointer"
                      title="Remove from Liked"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500 italic flex flex-col items-center justify-center gap-2">
            <Heart className="w-8 h-8 text-zinc-600 mb-1" />
            <span>No liked songs yet. Click the heart icon on any song while listening to save it here!</span>
          </div>
        )}
      </div>

      {/* Custom User Playlists */}
      {customPlaylists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {customPlaylists.map((pl) => (
            <div key={pl.id} className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-4 group">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                    <Disc className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{pl.name}</h3>
                    <p className="text-[10px] text-zinc-400">{pl.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePlaylist(pl.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete Playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 text-center text-xs text-zinc-500 italic">
                Playlist created. Add songs from search or room queues.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create New Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl bg-[#0F1626] border border-white/10 w-full max-w-md flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Create New Custom Playlist</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylistSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Playlist Name (e.g. Workout Energy)"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500"
                required
                autoFocus
              />
              <input
                type="text"
                placeholder="Short Description (optional)"
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E293B] text-xs font-bold text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-black"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
