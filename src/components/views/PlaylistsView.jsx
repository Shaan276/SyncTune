'use client';
import React, { useState } from 'react';
import { Music2, Play, Heart, Trash2, FolderPlus, X, Disc, Radio, Plus } from 'lucide-react';
import { formatTime } from '../../lib/youtube';

export default function PlaylistsView({
  likedSongs = [],
  customPlaylists = [],
  onCreatePlaylist,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onPlayPlaylist,
  onPlaySong,
  onToggleLike,
  activeRoom = null
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');

  const handleCreatePlaylistSubmit = (e) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    if (onCreatePlaylist) {
      onCreatePlaylist(playlistName.trim(), playlistDescription.trim());
    }
    setShowCreateModal(false);
    setPlaylistName('');
    setPlaylistDescription('');
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this playlist?')) {
      if (onDeletePlaylist) onDeletePlaylist(id);
    }
  };

  const handlePlayInRoom = (pl) => {
    if (onPlayPlaylist) {
      onPlayPlaylist(pl, true);
    }
  };

  const handlePlaySolo = (pl) => {
    if (onPlayPlaylist) {
      onPlayPlaylist(pl, false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Music2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide">Playlists & Collections</h2>
            <p className="text-xs text-zinc-400">Save custom playlists and stream them solo or in your live listening rooms</p>
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

          {likedSongs.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlaySolo({ name: 'Liked Songs', songs: likedSongs })}
                className="px-3 py-1.5 rounded-xl bg-[#141C30] hover:bg-[#1A243D] border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                <span>Play Solo</span>
              </button>

              {activeRoom && (
                <button
                  onClick={() => handlePlayInRoom({ name: 'Liked Songs', songs: likedSongs })}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Play in Room {activeRoom}</span>
                </button>
              )}
            </div>
          )}
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
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Disc className="w-4 h-4 text-emerald-400" />
          <span>Your Playlists ({customPlaylists.length})</span>
        </h3>

        {customPlaylists.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#0F1626] border border-white/5 text-center flex flex-col items-center justify-center gap-3">
            <FolderPlus className="w-10 h-10 text-zinc-600" />
            <div className="flex flex-col gap-1 max-w-sm">
              <h4 className="text-sm font-bold text-white">No Custom Playlists Yet</h4>
              <p className="text-xs text-zinc-400">
                Click &quot;+ New Playlist&quot; above, or use &quot;Save to Playlist&quot; in the bottom audio player while streaming.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {customPlaylists.map((pl) => {
              const songs = pl.songs || [];
              return (
                <div
                  key={pl.id}
                  className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                        <Disc className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h4 className="text-sm font-black text-white truncate">{pl.name}</h4>
                        <p className="text-[10px] text-zinc-400 truncate">{pl.description || `${songs.length} tracks`}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {songs.length > 0 && (
                        <>
                          <button
                            onClick={() => handlePlaySolo(pl)}
                            className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer"
                            title="Play Solo"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>

                          {activeRoom && (
                            <button
                              onClick={() => handlePlayInRoom(pl)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
                              title={`Play in Room ${activeRoom}`}
                            >
                              <Radio className="w-3 h-3" />
                              <span>Play in Room</span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => handleDelete(pl.id)}
                        className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Songs List */}
                  {songs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500 italic">
                      Playlist is empty. Click the playlist icon on any song to add tracks!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {songs.map((song) => (
                        <div
                          key={song.id}
                          className="p-2 px-2.5 rounded-xl bg-[#080C14] border border-white/5 flex items-center justify-between gap-2.5 hover:border-emerald-500/20 transition-all min-w-0"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={song.thumbnail} alt={song.title} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-white truncate">{song.title}</span>
                              <span className="text-[10px] text-zinc-400 truncate">{song.artist} • {formatTime(song.duration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onPlaySong && onPlaySong(song)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                              title="Play Track"
                            >
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </button>

                            {onRemoveFromPlaylist && (
                              <button
                                onClick={() => onRemoveFromPlaylist(pl.id, song.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Remove from Playlist"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create New Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
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
                placeholder="Playlist Name (e.g. Late Night Vibes)"
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
                  className="px-4 py-2 rounded-xl bg-[#1E293B] text-xs font-bold text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-black cursor-pointer shadow-lg shadow-emerald-500/20"
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