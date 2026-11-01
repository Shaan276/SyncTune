'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Radio, Trash2, Search, RefreshCw, CheckCircle2, AlertCircle, Music, Shield } from 'lucide-react';

export default function FriendsView({ user, setActiveRoom, setActiveTab }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const currentUserId = user?.id || user?.email;

  const fetchFriends = useCallback(async (isSilent = false) => {
    if (!currentUserId) {
      setFriends([]);
      setLoading(false);
      return;
    }

    if (!isSilent) setRefreshing(true);
    try {
      const uName = encodeURIComponent(user?.username || '');
      const uEmail = encodeURIComponent(user?.email || '');
      const res = await fetch(`/api/friends?userId=${encodeURIComponent(currentUserId)}&username=${uName}&email=${uEmail}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.friends)) {
          setFriends(data.friends);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch friends list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, user?.username, user?.email]);

  useEffect(() => {
    fetchFriends();
    // Poll friends status every 8 seconds
    const interval = setInterval(() => {
      fetchFriends(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchFriends]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    const query = searchQuery.trim();
    if (!query) return;

    if (!currentUserId) {
      setErrorMessage('Please sign in or create an account to add friends.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_request',
          userId: currentUserId,
          query,
          user: {
            id: currentUserId,
            username: user?.username || 'User'
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message || `Connected with ${data.friend?.name || query} successfully!`);
        setSearchQuery('');
        fetchFriends(true);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(data.error || 'Failed to connect. Please check the username or email.');
      }
    } catch (err) {
      setErrorMessage('Network error while adding friend. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_friend',
          userId: currentUserId,
          friendId
        })
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => String(f.id) !== String(friendId)));
      }
    } catch (err) {
      console.warn('Failed to remove friend:', err);
    }
  };

  const handleJoinFriendRoom = (code) => {
    if (!code) return;
    if (setActiveRoom) setActiveRoom(code);
    if (setActiveTab) setActiveTab('rooms');
  };

  return (
    <div className="flex flex-col gap-6 pb-28 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              <span>Friends & Live Listening</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                Real-Time Cloud
              </span>
            </h2>
            <p className="text-xs text-zinc-400">See what your friends are streaming and join their private rooms with 1 click</p>
          </div>
        </div>

        <button
          onClick={() => fetchFriends(false)}
          disabled={refreshing}
          className="px-3 py-1.5 rounded-xl bg-[#141C30] hover:bg-[#1A243D] border border-white/10 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-end sm:self-auto"
          title="Refresh friends status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Main Grid: Friends List + Add Friend Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Friends List Column */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Your Friends ({friends.length})</span>
            </h3>
            {user?.username && (
              <span className="text-xs text-zinc-400">
                Logged in as <strong className="text-emerald-400 font-bold">{user.username}</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3 py-8 items-center justify-center text-zinc-400 text-xs">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              <span>Loading cloud friends network...</span>
            </div>
          ) : friends.length === 0 ? (
            <div className="py-12 px-6 rounded-xl bg-[#080C14] border border-white/5 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h4 className="text-sm font-bold text-white">No Friends Connected Yet</h4>
                <p className="text-xs text-zinc-400">
                  Search for a friend&apos;s username or email on the right to sync playback and jump into each other&apos;s listening rooms.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {friends.map((f) => {
                const isListening = f.status === 'listening' || Boolean(f.active_room);
                const statusColor = isListening
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                  : f.is_online
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-zinc-500 bg-zinc-800/40 border-zinc-700/40';

                const statusText = isListening
                  ? 'Listening 🎧'
                  : f.is_online
                  ? 'Online 🟢'
                  : 'Offline ⚪';

                return (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl bg-[#080C14] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center justify-center uppercase">
                          {f.name ? f.name.charAt(0) : 'U'}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080C14] ${
                            f.is_online ? 'bg-emerald-500' : 'bg-zinc-600'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">{f.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400 truncate">
                          {f.email && <span className="truncate">{f.email}</span>}
                          {f.active_room && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="text-cyan-400 font-mono font-bold shrink-0">
                                Room {f.active_room}
                              </span>
                            </>
                          )}
                        </div>

                        {f.currentSong && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-300 truncate">
                            <Music className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
                            <span className="truncate">{f.currentSong.title}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {f.active_room && (
                        <button
                          onClick={() => handleJoinFriendRoom(f.active_room)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>Join Room</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleRemoveFriend(f.id)}
                        className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remove Friend"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Friend Sidebar Column */}
        <div className="p-6 rounded-2xl bg-[#0F1626] border border-white/5 flex flex-col gap-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Add New Friend</h3>
          </div>

          <p className="text-xs text-zinc-400">
            Enter the exact username or registered email of the user you want to connect with.
          </p>

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleAddFriend} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Username or Email</label>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/50">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. Alex, piyush@gmail.com..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !searchQuery.trim()}
              className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? 'Connecting...' : 'Connect Friend'}</span>
            </button>
          </form>

          <div className="mt-2 p-3.5 rounded-xl bg-[#080C14] border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cross-Device Cloud Sync</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Your friendships are synced across your mobile app and PC browser automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
