'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LiveReactionOverlay({ roomCode, activeRoom }) {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (!activeRoom) return;

    const channel = supabase.channel(`room-reactions-${activeRoom}`);

    channel
      .on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
        const id = Date.now() + Math.random();
        const newReaction = {
          id,
          emoji: payload.emoji,
          left: Math.random() * 80 + 10, // random left percentage
        };

        setReactions((prev) => [...prev, newReaction]);

        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 2500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom]);

  const sendReaction = (emoji) => {
    if (!activeRoom) return;

    const channel = supabase.channel(`room-reactions-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'emoji_reaction',
      payload: { emoji },
    });
  };

  if (!activeRoom) return null;

  return (
    <>
      {/* Floating Emojis Container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.left}%`, bottom: '120px' }}
            className="absolute text-4xl animate-float-emoji pointer-events-none drop-shadow-lg"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Floating Reaction Control Bar (bottom center above player) */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 border border-purple-500/30 shadow-xl">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">Reactions</span>
        {['🔥', '❤️', '🎵', '👏', '🎉'].map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-purple-500/20 hover:scale-125 transition-all text-base flex items-center justify-center active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
