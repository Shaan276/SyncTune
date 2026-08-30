'use client';
import React, { useEffect, useRef } from 'react';

export default function YouTubeAudioEngine({ currentSong, isPlaying, volume = 0.8, onTimeUpdate, onEnded }) {
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    // 1. Ensure YouTube IFrame API script is present
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

      playerRef.current = new window.YT.Player('synctune-ultra-low-audio-engine', {
        height: '1',
        width: '1',
        videoId: currentSong?.id || '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          playsinline: 1,
          suggestedQuality: 'small', // Request lowest resolution (144p audio stream only for ultra-low data)
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            try {
              event.target.setPlaybackQuality('small');
              event.target.setVolume(Math.floor(volume * 100));
              event.target.unMute();
              if (isPlaying && currentSong?.id) {
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

    // Global audio play method on user gesture
    window.syncTunePlayAudio = () => {
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    // Global seek audio method to prevent time snapping
    window.syncTuneSeekAudio = (targetSeconds) => {
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetSeconds, true);
          if (isPlaying) {
            playerRef.current.playVideo();
          }
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
          startSeconds: 0,
          suggestedQuality: 'small'
        });
        playerRef.current.setPlaybackQuality('small');
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
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, onTimeUpdate]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '1px',
        height: '1px',
        opacity: 0.001,
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      <div id="synctune-ultra-low-audio-engine" />
    </div>
  );
}
