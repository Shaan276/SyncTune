'use client';
import React, { useState } from 'react';
import { Music2, Plus, Play, Heart, Trash2, FolderPlus, X, Disc } from 'lucide-react';

export default function PlaylistsView({ likedSongs, onPlaySong, onToggleLike }) {
  const [playlists, setPlaylists] = useState([
    {
      id: 1,
      name: 'Liked Songs',
      description: 'Your favorite saved songs',
      count: likedSongs ? likedSongs.length : 1,
      songs: likedSongs && likedSongs.length > 0 ? likedSongs : [
        { id: "hT_nvWreIhg", title: "One Love", artist: "Shubh", duration: 160, thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg" }
      ]
    },
    {
      id: 2,
      name: 'Late Night Chill',
      description: 'Relaxed acoustic & lo-fi beats',
      count: 1,
      songs: [
        { id: "vJQMv7A_N30", title: "Cheques", artist: "Shubh", duration: 184, thumbnail: "https://img.youtube.com/vi/vJQMv7A_N30/mqdefault.jpg" }
      ]
    }
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
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex items-center justify-between gap-4">
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

      {/* Playlists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {playlists.map((pl) => (
          <div key={pl.id} className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-4 group">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                  <Disc className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{pl.name}</h3>
                  <p className="text-[10px] text-zinc-400">{pl.description || `${pl.songs.length} tracks`}</p>
                </div>
              </div>

              {pl.id !== 1 && (
                <button
                  onClick={() => handleDeletePlaylist(pl.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete Playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 min-h-[100px]">
              {pl.songs && pl.songs.length > 0 ? (
                pl.songs.map((song) => (
                  <div key={song.id} className="p-2.5 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {song.thumbnail && (
                        <img src={song.thumbnail} alt={song.title} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">{song.title}</span>
                        <span className="text-[10px] text-zinc-400 truncate">{song.artist}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onPlaySong(song)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer shrink-0"
                      title="Play Track"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 text-xs italic my-auto py-6">
                  No tracks in this playlist yet.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#0F1626] border border-white/10 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-sm font-black text-white">Create New Playlist</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylistSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-300">Playlist Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Gym Beats, Workout 2026..."
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500/50"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-300">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-[#080C14] border border-white/10 text-xs text-white outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-md shadow-emerald-500/20"
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
