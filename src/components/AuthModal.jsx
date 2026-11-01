'use client';
import React, { useState } from 'react';
import { Radio, Lock, Mail, User, ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export default function AuthModal({ onLogin, onClose, allowClose = false }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getLocalAccounts = () => {
    try {
      const stored = localStorage.getItem('synctune_registered_accounts');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  };

  const saveLocalAccounts = (accounts) => {
    try {
      localStorage.setItem('synctune_registered_accounts', JSON.stringify(accounts));
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = isRegister ? username.trim() : '';

    if (!cleanEmail) {
      setError('Please provide a valid email address.');
      setLoading(false);
      return;
    }

    if (!password || password.length < 3) {
      setError('Password must be at least 3 characters long.');
      setLoading(false);
      return;
    }

    if (isRegister && !cleanUsername) {
      setError('Please choose a username.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'register' : 'login',
          username: cleanUsername,
          email: cleanEmail,
          password
        })
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data && data.success && data.user) {
        // Sync local client accounts cache
        const localList = getLocalAccounts();
        if (!localList.some(a => a.email === cleanEmail)) {
          localList.push({
            id: data.user.id,
            username: data.user.username,
            email: cleanEmail,
            password: password,
            role: data.user.role
          });
          saveLocalAccounts(localList);
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token || `synctune-jwt-${data.user.id}`);
        onLogin(data.user);
        setLoading(false);
        return;
      }

      // If server returned a business error (e.g. wrong password, email not found)
      if (data && data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Auth API network error, checking synced local credentials store:', err);
    }

    // Client-side authentication check against persistent accounts
    const localList = getLocalAccounts();

    if (isRegister) {
      const exists = localList.find(a => a.email === cleanEmail);
      if (exists) {
        setError('An account with this email already exists. Please switch to Sign In.');
        setLoading(false);
        return;
      }

      const newAcc = {
        id: Date.now(),
        username: cleanUsername,
        email: cleanEmail,
        password: password,
        role: 'user'
      };

      localList.push(newAcc);
      saveLocalAccounts(localList);

      const safeUser = { id: newAcc.id, username: newAcc.username, email: newAcc.email, role: newAcc.role };
      localStorage.setItem('user', JSON.stringify(safeUser));
      localStorage.setItem('token', `synctune-jwt-${safeUser.id}`);
      onLogin(safeUser);
      setLoading(false);
      return;
    } else {
      // Login check
      const account = localList.find(a => a.email === cleanEmail || a.username.toLowerCase() === cleanEmail);
      if (!account) {
        setError('No account found with this email. Please click "Create New ID" to register first.');
        setLoading(false);
        return;
      }

      if (account.password !== password) {
        setError('Incorrect password. Please verify and try again.');
        setLoading(false);
        return;
      }

      const safeUser = { id: account.id, username: account.username, email: account.email, role: account.role };
      localStorage.setItem('user', JSON.stringify(safeUser));
      localStorage.setItem('token', `synctune-jwt-${safeUser.id}`);
      onLogin(safeUser);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-7 rounded-2xl bg-[#0F1626] border border-white/10 shadow-2xl relative overflow-hidden flex flex-col gap-6 animate-in fade-in zoom-in duration-200">

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Radio className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">SyncTune</h2>
            <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-semibold mt-0.5">
              Audio OS • Synchronous Music Engine
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 rounded-xl bg-[#080C14] border border-white/10">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !isRegister
                ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isRegister
                ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New ID</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Choose Display Name / Username</label>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/60 transition-all">
                <User className="w-4 h-4 text-emerald-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex, Piyush, NeonBeat..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                  required={isRegister}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">
              {isRegister ? 'Email Address' : 'Email or Username'}
            </label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/60 transition-all">
              <Mail className="w-4 h-4 text-emerald-400" />
              <input
                type={isRegister ? 'email' : 'text'}
                placeholder={isRegister ? 'your.email@example.com' : 'Enter email or username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">Password</label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#080C14] border border-white/10 focus-within:border-emerald-500/60 transition-all">
              <Lock className="w-4 h-4 text-emerald-400" />
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Verifying Credentials...' : (isRegister ? 'Register & Enter SyncTune' : 'Sign In')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {allowClose && onClose && (
          <div className="pt-2 border-t border-white/10 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
