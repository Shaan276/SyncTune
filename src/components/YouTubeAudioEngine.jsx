'use client';
import React, { useEffect, useRef } from 'react';

// 44-byte silent WAV data URI to keep mobile OS audio session active
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export default function YouTubeAudioEngine({
  currentSong,
  isPlaying,
  volume = 0.8,
  currentTime = 0,
  duration = 100,
  onTimeUpdate,
  onEnded,
  onPlay,
  onPause,
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
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onTogglePlayRef = useRef(onTogglePlay);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPrevRef = useRef(onSkipPrev);
  const onSeekRef = useRef(onSeek);

  const silentAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const isAudioUnlockedRef = useRef(false);

  // Sync latest callback references
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);
  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);
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

  // 1. Synchronously Unlock Audio Pipeline on User Interaction (Required for iOS Safari & Android Chrome)
  useEffect(() => {
    const unlockAudioSession = () => {
      // 0. AudioSession API for iOS
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'playback';
        } catch (e) {}
      }

      // Unlock HTML5 Audio
      const audio = silentAudioRef.current;
      if (audio) {
        audio.play().catch(() => {});
      }

      // Unlock Web Audio API AudioContext
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const buffer = ctx.createBuffer(1, 1, 22050);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
            audioContextRef.current = ctx;
          }
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (e) {}

      // If YouTube player is already initialized and supposed to play, ensure it is unmuted
      if (playerRef.current && isReadyRef.current && isPlayingRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }

      isAudioUnlockedRef.current = true;
    };

    window.addEventListener('touchstart', unlockAudioSession, { passive: true });
    window.addEventListener('touchend', unlockAudioSession, { passive: true });
    window.addEventListener('click', unlockAudioSession, { passive: true });
    window.addEventListener('keydown', unlockAudioSession, { passive: true });

    return () => {
      window.removeEventListener('touchstart', unlockAudioSession);
      window.removeEventListener('touchend', unlockAudioSession);
      window.removeEventListener('click', unlockAudioSession);
      window.removeEventListener('keydown', unlockAudioSession);
    };
  }, [volume]);

  // 2. Manage Audio Session when isPlaying changes
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (audioContextRef.current) {
      if (isPlaying && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }
  }, [isPlaying]);

  // 3. MediaSession API integration for Lock Screen and Notification Center
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
          if (playerRef.current && isReadyRef.current) {
            try {
              playerRef.current.unMute();
              playerRef.current.setVolume(Math.floor(volume * 100));
              playerRef.current.playVideo();
            } catch (e) {}
          }
          if (silentAudioRef.current) {
            silentAudioRef.current.play().catch(() => {});
          }
          if (onPlayRef.current) {
            onPlayRef.current();
          } else if (onTogglePlayRef.current) {
            onTogglePlayRef.current();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (playerRef.current && isReadyRef.current) {
            try {
              playerRef.current.pauseVideo();
            } catch (e) {}
          }
          if (silentAudioRef.current) {
            silentAudioRef.current.pause();
          }
          if (onPauseRef.current) {
            onPauseRef.current();
          } else if (onTogglePlayRef.current) {
            onTogglePlayRef.current();
          }
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

        if ('setPositionState' in navigator.mediaSession && duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, duration),
            playbackRate: 1,
            position: Math.min(currentTime, duration)
          });
        }
      } catch (err) {}
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, isPlaying, duration, volume]);

  // 4. Initialize YouTube IFrame API
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
        height: '240',
        width: '320',
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
            } else if (event.data === window.YT.PlayerState.PLAYING) {
              try {
                event.target.unMute();
                event.target.setVolume(Math.floor(volume * 100));
              } catch (e) {}
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              // Mobile browser attempt to pause video when minimized/locked
              if (isPlayingRef.current) {
                // Instantly re-assert playback so music doesn't stop
                setTimeout(() => {
                  try {
                    if (isPlayingRef.current && playerRef.current) {
                      playerRef.current.unMute();
                      playerRef.current.playVideo();
                    }
                  } catch (e) {}
                }, 50);
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

    // Global helper methods
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
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    window.syncTuneSeekAudio = (targetSeconds) => {
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetSeconds, true);
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    // 5. Lifecycle event handlers: NEVER pause audio on visibilitychange/pagehide
    const handleVisibilityChange = () => {
      if (isPlayingRef.current && playerRef.current) {
        try {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          if (silentAudioRef.current) {
            silentAudioRef.current.play().catch(() => {});
          }
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
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
      if (currentSong.id !== lastSongIdRef.current || currentSong.playTrigger) {
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
    }
  }, [currentSong?.id, currentSong?.playTrigger, volume]);

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
  }, [isPlaying, volume]);

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

  // Time tracking and background auto-correction loop
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

            // Auto-resume if mobile OS attempted to pause in background
            if (isPlayingRef.current) {
              const state = playerRef.current.getPlayerState();
              if (state === 2) {
                // State 2 is PAUSED
                playerRef.current.unMute();
                playerRef.current.playVideo();
              } else if (state === 1 && typeof playerRef.current.isMuted === 'function' && playerRef.current.isMuted()) {
                playerRef.current.unMute();
                playerRef.current.setVolume(Math.floor(volume * 100));
              }
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, volume]);

  return (
    <>
      {/* Real HTML5 audio carrier element unlocked by user interaction */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Styled with scale(0.001) so browser and YouTube detect normal dimensions without auto-pause */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '320px',
          height: '240px',
          transform: 'scale(0.001)',
          transformOrigin: 'bottom right',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        <div id="synctune-ultra-low-audio-engine" />
      </div>
    </>
  );
}
