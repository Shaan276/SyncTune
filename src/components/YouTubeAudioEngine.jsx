'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Radio, Minimize2, Maximize2 } from 'lucide-react';

export default function YouTubeAudioEngine({ currentSong, isPlaying, volume = 0.8, onTimeUpdate, onEnded }) {
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);
  const [isMiniVisible, setIsMiniVisible] = useState(true);

  useEffect(() => {
    // 1. Ensure YouTube IFrame API script is in document head
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0] || document.head.appendChild(tag);
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    }

    const initPlayer = () => {
      if (playerRef.current || !window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player('synctune-live-audio-frame', {
        height: '100%',
        width: '100%',
        videoId: currentSong?.id || '4NRXx6U8ABQ',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            try {
              event.target.setVolume(Math.floor(volume * 100));
              event.target.unMute();
              if (isPlaying) {
                event.target.playVideo();
              }
            } catch (e) {}
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              if (onEnded) onEnded();
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Global audio unlock method callable on any user gesture
    window.syncTunePlayAudio = () => {
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, []);

  // Track change
  useEffect(() => {
    if (playerRef.current && isReadyRef.current && currentSong?.id) {
      try {
        playerRef.current.loadVideoById({
          videoId: currentSong.id,
          startSeconds: 0
        });
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.floor(volume * 100));
        if (isPlaying) {
          playerRef.current.playVideo();
        }
      } catch (err) {
        console.error("Error loading YouTube track:", err);
      }
    }
  }, [currentSong?.id]);

  // Play / Pause toggle
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (err) {}
    }
  }, [isPlaying]);

  // Volume change
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.setVolume(Math.floor(volume * 100));
        if (volume > 0) {
          playerRef.current.unMute();
        }
      } catch (err) {}
    }
  }, [volume]);

  // Time tracking interval
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const time = playerRef.current.getCurrentTime();
            if (onTimeUpdate && !isNaN(time)) {
              onTimeUpdate(time);
            }
          } catch (e) {}
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, onTimeUpdate]);

  return (
    <div
      className="fixed bottom-24 right-4 z-40 glass-panel border border-purple-500/30 overflow-hidden shadow-2xl transition-all duration-300 rounded-xl"
      style={{
        width: isMiniVisible ? '160px' : '36px',
        height: isMiniVisible ? '100px' : '36px',
        opacity: isMiniVisible ? 0.95 : 0.4
      }}
    >
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div id="synctune-live-audio-frame" className="w-full h-full" />
        
        {/* Toggle Mini Dock Overlay */}
        <button
          onClick={() => setIsMiniVisible(!isMiniVisible)}
          className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white/80 hover:text-white text-[10px] z-50 backdrop-blur-sm"
          title={isMiniVisible ? "Minimize Audio Stream Dock" : "Expand Audio Stream Dock"}
        >
          {isMiniVisible ? <Minimize2 className="w-3 h-3" /> : <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
        </button>
      </div>
    </div>
  );
}
