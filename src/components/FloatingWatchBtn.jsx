'use client';
import React from 'react';
import { Tv } from 'lucide-react';

export default function FloatingWatchBtn({ onClick, isRoom, isOpen }) {
  if (!isRoom) return null;

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-24 right-6 w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 text-white flex items-center justify-center shadow-xl shadow-purple-500/30 border border-white/20 hover:scale-110 active:scale-95 transition-all z-40 ${
        isOpen ? 'ring-2 ring-cyan-400' : ''
      }`}
      title="Toggle Watch Together Cinema"
    >
      <Tv className="w-5 h-5 animate-pulse" />
    </button>
  );
}
