'use client';
import React, { useEffect, useRef } from 'react';

export default function YouTubeAudioEngine({ currentSong, isPlaying, volume = 0.8, onTimeUpdate, onEnded }) {
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    // 1. Load YouTube IFrame API script if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (playerRef.current || !window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player('next-yt-audio-player', {
        height: '200',
        width: '200',
        videoId: currentSong?.id || 'hT_nvWreIhg',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            event.target.setVolume(volume * 100);
            event.target.unMute();
            if (isPlaying) {
              event.target.playVideo();
            }
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
        playerRef.current.loadVideoById(currentSong.id);
        playerRef.current.unMute();
        playerRef.current.setVolume(volume * 100);
        if (isPlaying) {
          playerRef.current.playVideo();
        }
      } catch (err) {
        console.error("Error loading YouTube song:", err);
      }
    }
  }, [currentSong?.id]);

  // Play / Pause toggle
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.unMute();
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
        playerRef.current.setVolume(volume * 100);
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
      id="next-yt-audio-player"
      style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '200px', height: '200px', pointerEvents: 'none' }}
    />
  );
}
