'use client';
import React, { useState } from 'react';
import { Shield, Users, Radio, Zap, Broadcast, Trash2, UserPlus, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminView({ user, setActiveRoom }) {
  const [usersList, setUsersList] = useState([
    { id: 1, username: 'piyush', email: 'piyushpilkhwal74@gmail.com', role: 'admin', current_status: 'active', todayMB: 4.2, monthMB: 128.5 },
    { id: 2, name: 'Aarav', email: 'aarav@gmail.com', role: 'user', current_status: 'listening', todayMB: 12.8, monthMB: 340.0 },
    { id: 3, name: 'Ananya', email: 'ananya@gmail.com', role: 'user', current_status: 'active', todayMB: 1.5, monthMB: 45.2 },
  ]);

  const [activeRooms, setActiveRooms] = useState([
    { code: 'BEAT1', host_name: 'Piyush', member_count: 5, song_title: 'One Love', is_playing: 1 }
  ]);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');

  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    const channel = supabase.channel('system-broadcasts');
    channel.send({
      type: 'broadcast',
      event: 'system_toast',
      payload: { message: broadcastMsg.trim() }
    });

    alert(`Live system broadcast sent: "${broadcastMsg}"`);
    setBroadcastMsg('');
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) return;

    const newUser = {
      id: Date.now(),
      username: newUsername,
      email: newEmail,
      role: newRole,
      current_status: 'active',
      todayMB: 0,
      monthMB: 0
    };

    setUsersList((prev) => [newUser, ...prev]);
    setShowAddUserModal(false);
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    alert('User added successfully!');
  };

  const handleDeleteUser = (id) => {
    if (confirm('Are you sure you want to remove this user?')) {
      setUsersList((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleToggleRole = (id) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' } : u))
    );
  };

  const handleDestroyRoom = (code) => {
    if (confirm(`Force-close room ${code}?`)) {
      setActiveRooms((prev) => prev.filter((r) => r.code !== code));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white text-glow-pink flex items-center gap-2">
            <Shield className="w-6 h-6 text-pink-400" />
            <span>Admin Management Control</span>
          </h2>
          <p className="text-xs text-zinc-400">System-wide bandwidth audit, room coordination, and listener telemetry</p>
        </div>

        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Live System Broadcast Banner */}
      <div className="glass-panel p-5 flex flex-col gap-3 border border-pink-500/30">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>📣 Broadcast Live System Toast</span>
        </h3>

        <form onSubmit={handleSendBroadcast} className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message to broadcast to all online listeners in real-time..."
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-pink-600 text-white font-bold text-xs hover:bg-pink-500 transition-colors"
          >
            Broadcast
          </button>
        </form>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Listeners</span>
          <span className="text-2xl font-black text-purple-400">{usersList.length}</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Active Rooms</span>
          <span className="text-2xl font-black text-cyan-400">{activeRooms.length}</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Bandwidth Saved</span>
          <span className="text-2xl font-black text-emerald-400">482 MB</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Listens</span>
          <span className="text-2xl font-black text-pink-400">1,240</span>
        </div>
      </div>

      {/* User Management Table & Active Rooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-4 overflow-x-auto">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Directory & Roles</h3>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                <th className="p-2">User</th>
                <th className="p-2">Role</th>
                <th className="p-2">Usage (Today/Month)</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{u.username || u.name}</span>
                      <span className="text-[10px] text-zinc-400">{u.email}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-pink-500/20 text-pink-300' : 'bg-white/10 text-zinc-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-zinc-300">
                    {u.todayMB} MB / {u.monthMB} MB
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleRole(u.id)}
                        className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold hover:bg-purple-500/30"
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active Rooms Control Panel */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Rooms</h3>

          <div className="flex flex-col gap-3">
            {activeRooms.map((r) => (
              <div key={r.code} className="glass-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-cyan-400 text-xs">{r.code}</span>
                  <span className="text-[10px] text-zinc-400 font-semibold">{r.member_count} listeners</span>
                </div>
                <span className="text-xs text-zinc-300">Host: {r.host_name}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveRoom(r.code)}
                    className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs hover:bg-cyan-500/30 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Stealth Join</span>
                  </button>
                  <button
                    onClick={() => handleDestroyRoom(r.code)}
                    className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-bold text-xs hover:bg-red-500/30 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Destroy</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 w-full max-w-md flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">Add New User Account</h3>
            <form onSubmit={handleAddUser} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white outline-none"
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white outline-none"
                required
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white outline-none"
              >
                <option value="user" className="bg-zinc-900">Listener (user)</option>
                <option value="admin" className="bg-zinc-900">Administrator (admin)</option>
              </select>
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 text-xs font-bold text-white"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
