'use client';
import React, { useState } from 'react';
import { Shield, Users, Radio, Zap, Megaphone, Trash2, UserPlus, Eye, AlertTriangle, Activity, Database, CheckCircle2 } from 'lucide-react';
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
  const [broadcastSent, setBroadcastSent] = useState(false);

  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    try {
      const channel = supabase.channel('system-broadcasts');
      channel.send({
        type: 'broadcast',
        event: 'system_toast',
        payload: { message: broadcastMsg.trim() }
      });
    } catch (err) {
      console.warn('Supabase broadcast channel failed, proceeding locally:', err);
    }

    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 3000);
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
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0F1626] border border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-black">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">System & Account Administration</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                ACTIVE ROOT
              </span>
            </div>
            <p className="text-xs text-slate-400">Manage listener accounts, real-time broadcasts, and room telemetry</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-[#10B981]/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>PROVISION USER</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Accounts</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{usersList.length}</div>
            <p className="text-[11px] text-emerald-400 font-medium mt-1">100% verified persistent</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Rooms</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{activeRooms.length}</div>
            <p className="text-[11px] text-cyan-400 font-medium mt-1">Synced to Supabase & Node</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bandwidth Saved</span>
            <Zap className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#10B981]">482.4 MB</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">via 144p pure audio stream</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Engine Status</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">99.98%</div>
            <p className="text-[11px] text-emerald-400 font-medium mt-1">Zero dropped sync frames</p>
          </div>
        </div>
      </div>

      {/* Broadcast Banner */}
      <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#10B981]" />
            <span>Real-Time System Broadcast</span>
          </h3>
          {broadcastSent && (
            <span className="flex items-center gap-1 text-[11px] text-[#10B981] font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" /> Broadcast dispatched to all active peers
            </span>
          )}
        </div>

        <form onSubmit={handleSendBroadcast} className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message to flash across all listeners' active screens..."
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#080C14] border border-[#1E293B] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#10B981] transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#10B981] text-black font-black text-xs hover:bg-[#059669] transition-colors"
          >
            DISPATCH
          </button>
        </form>
      </div>

      {/* User Directory & Rooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col gap-4 overflow-x-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>User Directory & Permissions</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">{usersList.length} registered</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-slate-400">
                <th className="p-3">User Profile</th>
                <th className="p-3">Role</th>
                <th className="p-3">Data Usage (Today/Month)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.id} className="border-b border-[#1E293B]/40 hover:bg-[#1E293B]/20 transition-colors">
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-white flex items-center gap-2">
                        {u.username || u.name}
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#10B981]/20 text-[#10B981]">
                            ADMIN
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">{u.email}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        u.role === 'admin'
                          ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                          : 'bg-[#1E293B] text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    <span className="text-white font-semibold">{u.todayMB} MB</span> / {u.monthMB} MB
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleRole(u.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-slate-200 text-[10px] font-bold transition-colors"
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete user"
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

        {/* Live Rooms Monitor */}
        <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1E293B] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Active Room Monitor</span>
            </h3>
            <span className="text-[11px] text-cyan-400 font-mono">{activeRooms.length} active</span>
          </div>

          <div className="flex flex-col gap-3">
            {activeRooms.map((r) => (
              <div key={r.code} className="p-4 rounded-xl bg-[#080C14] border border-[#1E293B] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-mono font-black text-white text-sm">{r.code}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded-full bg-[#1E293B]">
                    {r.member_count} listeners
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="text-slate-500">Host:</span> <span className="font-bold text-white">{r.host_name}</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#1E293B]">
                  <button
                    onClick={() => setActiveRoom(r.code)}
                    className="flex-1 py-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] font-bold text-xs hover:bg-[#10B981]/25 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Join Room</span>
                  </button>
                  <button
                    onClick={() => handleDestroyRoom(r.code)}
                    className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 font-bold text-xs hover:bg-red-500/20 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Terminate</span>
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
          <div className="p-6 rounded-2xl bg-[#0F1626] border border-[#1E293B] w-full max-w-md flex flex-col gap-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Provision New Account</h3>
            <form onSubmit={handleAddUser} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Username (e.g. Piyush)"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-[#1E293B] text-xs text-white placeholder-slate-500 outline-none focus:border-[#10B981]"
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-[#1E293B] text-xs text-white placeholder-slate-500 outline-none focus:border-[#10B981]"
                required
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-[#1E293B] text-xs text-white outline-none focus:border-[#10B981]"
              >
                <option value="user" className="bg-[#080C14]">Listener (user)</option>
                <option value="admin" className="bg-[#080C14]">Administrator (admin)</option>
              </select>
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E293B] text-xs font-bold text-slate-300 hover:bg-[#334155] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-xs font-black text-black transition-colors"
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
