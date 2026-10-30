'use client';
import React, { useEffect, useRef } from 'react';

// 44-byte valid silent WAV data URI to maintain mobile background audio session
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export default function YouTubeAudioEngine({
  currentSong,
  isPlaying,
  volume = 0.8,
  onTimeUpdate,
  onEnded,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek
}) {
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);
  const lastSongIdRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onTogglePlayRef = useRef(onTogglePlay);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPrevRef = useRef(onSkipPrev);
  const onSeekRef = useRef(onSeek);
  const silentAudioRef = useRef(null);

  // Keep callback references fresh
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);
  useEffect(() => {
    onTogglePlayRef.current = onTogglePlay;
  }, [onTogglePlay]);
  useEffect(() => {
    onSkipNextRef.current = onSkipNext;
  }, [onSkipNext]);
  useEffect(() => {
    onSkipPrevRef.current = onSkipPrev;
  }, [onSkipPrev]);
  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  // 1. Silent HTML5 Audio carrier management for mobile background persistence
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // 2. Setup MediaSession API (Lock screen & notification center controls)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (currentSong) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentSong.title || 'SyncTune Track',
          artist: currentSong.artist || 'SyncTune Artist',
          album: 'SyncTune Audio OS',
          artwork: [
            {
              src: currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.id}/mqdefault.jpg`,
              sizes: '96x96',
              type: 'image/jpeg'
            },
            {
              src: currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.id}/hqdefault.jpg`,
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => {
          if (onTogglePlayRef.current) onTogglePlayRef.current();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (onTogglePlayRef.current) onTogglePlayRef.current();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (onSkipPrevRef.current) onSkipPrevRef.current();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (onSkipNextRef.current) onSkipNextRef.current();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            if (onSeekRef.current) onSeekRef.current(details.seekTime);
            if (window.syncTuneSeekAudio) window.syncTuneSeekAudio(details.seekTime);
          }
        });
      } catch (err) {}
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, isPlaying]);

  // 3. YouTube Player Initialization & Background Auto-Resume
  useEffect(() => {
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
          suggestedQuality: 'small',
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            try {
              event.target.setPlaybackQuality('small');
              event.target.setVolume(Math.floor(volume * 100));
              event.target.unMute();
              if (isPlayingRef.current && currentSong?.id) {
                event.target.playVideo();
              }
            } catch (e) {}
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              if (onEndedRef.current) {
                onEndedRef.current();
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              // Mobile browser auto-paused player on minimize or screen lock
              if (document.hidden && isPlayingRef.current) {
                setTimeout(() => {
                  try {
                    playerRef.current?.playVideo();
                  } catch (e) {}
                }, 150);
              }
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

    // 4. Global helper methods
    window.syncTunePlayAudio = (songId) => {
      if (playerRef.current && isReadyRef.current) {
        try {
          if (songId && songId !== lastSongIdRef.current) {
            playerRef.current.loadVideoById({
              videoId: songId,
              startSeconds: 0,
              suggestedQuality: 'small'
            });
            lastSongIdRef.current = songId;
          }
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }
    };

    window.syncTuneSeekAudio = (targetSeconds) => {
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetSeconds, true);
          playerRef.current.unMute();
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    // 5. Visibility Change & Background Resilience Handler
    const handleVisibilityChange = () => {
      if (document.hidden && isPlayingRef.current && playerRef.current) {
        // Tab went to background or minimized: Keep audio alive
        try {
          if (silentAudioRef.current) {
            silentAudioRef.current.play().catch(() => {});
          }
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
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
        lastSongIdRef.current = currentSong.id;
        playerRef.current.loadVideoById({
          videoId: currentSong.id,
          startSeconds: 0,
          suggestedQuality: 'small'
        });
        playerRef.current.setPlaybackQuality('small');
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.floor(volume * 100));
        playerRef.current.playVideo();
      } catch (err) {
        console.error("Error loading YouTube track:", err);
      }
    }
  }, [currentSong?.id, currentSong?.playTrigger]);

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

  // Time tracking and background keep-alive loop
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const time = playerRef.current.getCurrentTime();
            if (onTimeUpdateRef.current && !isNaN(time)) {
              onTimeUpdateRef.current(time);
            }

            // If hidden on mobile and player got paused by OS, resume it
            if (document.hidden && isPlayingRef.current) {
              const state = playerRef.current.getPlayerState();
              if (state === 2) {
                // 2 is PAUSED
                playerRef.current.playVideo();
              }
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <>
      {/* Silent HTML5 audio element for mobile OS background audio persistence */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
        style={{ display: 'none' }}
      />

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
    </>
  );
}
