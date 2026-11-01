'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Tv, X, Radio, Sparkles, Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function CinemaPlayer({ isOpen, onClose, currentSong, activeRoom }) {
  const iframeRef = useRef(null);
  const [isSyncedPlaying, setIsSyncedPlaying] = useState(true);

  // Sync event listener via Supabase
  useEffect(() => {
    if (!isOpen || !activeRoom) return;

    const channel = supabase.channel(`cinema-sync-${activeRoom}`);

    channel
      .on('broadcast', { event: 'cinema_control' }, ({ payload }) => {
        if (!iframeRef.current || !iframeRef.current.contentWindow) return;

        if (payload.action === 'pause') {
          setIsSyncedPlaying(false);
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
            '*'
          );
        } else if (payload.action === 'play') {
          setIsSyncedPlaying(true);
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
            '*'
          );
        } else if (payload.action === 'seek') {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [payload.time, true] }),
            '*'
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, activeRoom]);

  const broadcastCinemaAction = (action, time = 0) => {
    if (!activeRoom) return;
    const channel = supabase.channel(`cinema-sync-${activeRoom}`);
    channel.send({
      type: 'broadcast',
      event: 'cinema_control',
      payload: { action, time }
    });
  };

  const handleToggleCinemaPlayback = () => {
    const nextState = !isSyncedPlaying;
    setIsSyncedPlaying(nextState);

    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: nextState ? 'playVideo' : 'pauseVideo', args: '' }),
        '*'
      );
    }

    broadcastCinemaAction(nextState ? 'play' : 'pause');
  };

  const handleSeekOffset = (secondsOffset) => {
    // Tell iframe to seek and broadcast
    if (iframeRef.current && iframeRef.current.contentWindow) {
      broadcastCinemaAction('seek_relative', secondsOffset);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white">SyncTune Cinema • Independent Synced Stream</h3>
              {activeRoom && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  Room {activeRoom} Synced
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-md">
              {currentSong?.title ? `${currentSong.title} — ${currentSong.artist}` : 'Watch video stream in sync with all room members'}
            </p>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-2">
          {activeRoom && (
            <button
              onClick={handleToggleCinemaPlayback}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSyncedPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500 text-black'
              }`}
            >
              {isSyncedPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSyncedPlaying ? 'Sync Pause for All' : 'Sync Play for All'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <X className="w-4 h-4" />
            <span>Exit Cinema</span>
          </button>
        </div>
      </div>

      {/* Full-Screen Embedded Video Area */}
      <div className="relative w-full flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
        {currentSong?.id ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${currentSong.id}?autoplay=1&controls=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-500 text-center">
            <Tv className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">Select any song in the room to launch Cinema Video</p>
          </div>
        )}
      </div>
    </div>
  );
}
