'use client';
import React, { useEffect, useRef, useState } from 'react';

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
  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);
  const lastSongIdRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const useIframeFallbackRef = useRef(false);
  useIframeFallbackRef.current = useIframeFallback;

  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onTogglePlayRef = useRef(onTogglePlay);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPrevRef = useRef(onSkipPrev);
  const onSeekRef = useRef(onSeek);

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

  // 1. Synchronously Unlock Audio Pipeline on User Interaction (iOS Safari & Android Chrome)
  useEffect(() => {
    const unlockAudioSession = () => {
      // AudioSession API for iOS
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'playback';
        } catch (e) {}
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

      // Unlock Native HTML5 Audio
      const audio = audioRef.current;
      if (audio && isPlayingRef.current) {
        audio.play().catch(() => {});
      }

      // Unlock YouTube iframe fallback if active
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

  // 2. Manage Native Audio & Fallback playback when isPlaying changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !useIframeFallback) {
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (useIframeFallback && playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {}
    }

    if (audioContextRef.current && isPlaying && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, [isPlaying, useIframeFallback, volume]);

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
          if (audioRef.current && !useIframeFallbackRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (useIframeFallbackRef.current && playerRef.current && isReadyRef.current) {
            try {
              playerRef.current.unMute();
              playerRef.current.setVolume(Math.floor(volume * 100));
              playerRef.current.playVideo();
            } catch (e) {}
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          if (onPlayRef.current) {
            onPlayRef.current();
          } else if (onTogglePlayRef.current) {
            onTogglePlayRef.current();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (playerRef.current && isReadyRef.current) {
            try {
              playerRef.current.pauseVideo();
            } catch (e) {}
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
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
            playbackRate: isPlaying ? 1 : 0,
            position: Math.min(currentTime, duration)
          });
        }
      } catch (err) {}
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, isPlaying, duration, volume]);

  // 4. Initialize YouTube IFrame API ONLY IF fallback is required
  useEffect(() => {
    if (!useIframeFallback) return;

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
              if (typeof event.target.getIframe === 'function') {
                const iframe = event.target.getIframe();
                if (iframe) {
                  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                  iframe.setAttribute('playsinline', '1');
                  iframe.setAttribute('webkit-playsinline', '1');
                }
              }
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
  }, [useIframeFallback]);

  // Global helper methods
  useEffect(() => {
    window.syncTunePlayAudio = (songId) => {
      setUseIframeFallback(false);
      if (audioRef.current) {
        if (songId && songId !== lastSongIdRef.current) {
          lastSongIdRef.current = songId;
          audioRef.current.src = `/api/stream?id=${encodeURIComponent(songId)}`;
        }
        audioRef.current.volume = volume;
        audioRef.current.play().catch(() => {});
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    window.syncTuneSeekAudio = (targetSeconds) => {
      if (audioRef.current && !useIframeFallbackRef.current) {
        try {
          audioRef.current.currentTime = targetSeconds;
          if (isPlayingRef.current) {
            audioRef.current.play().catch(() => {});
          }
        } catch (e) {}
      }
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetSeconds, true);
          if (useIframeFallbackRef.current && isPlayingRef.current) {
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor(volume * 100));
            playerRef.current.playVideo();
          }
        } catch (e) {}
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && isPlayingRef.current) {
        try {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          if (audioRef.current && !useIframeFallbackRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
          if (useIframeFallbackRef.current && playerRef.current) {
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor(volume * 100));
            playerRef.current.playVideo();
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
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
  }, [volume]);

  // 5. Track change handler
  useEffect(() => {
    if (!currentSong?.id) return;

    if (currentSong.id !== lastSongIdRef.current || currentSong.playTrigger) {
      lastSongIdRef.current = currentSong.id;
      setUseIframeFallback(false);

      if (audioRef.current) {
        audioRef.current.src = `/api/stream?id=${encodeURIComponent(currentSong.id)}`;
        audioRef.current.volume = volume;
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.warn('[SyncTune Audio] Direct play deferred:', err);
          });
        }
      }
    }
  }, [currentSong?.id, currentSong?.playTrigger, isPlaying, volume]);

  // 6. Volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
    if (playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.setVolume(Math.floor(volume * 100));
        if (volume > 0) playerRef.current.unMute();
      } catch (err) {}
    }
  }, [volume]);

  // 7. Time tracking for iframe fallback (native audio uses onTimeUpdate event directly)
  useEffect(() => {
    let interval;
    if (isPlaying && useIframeFallback) {
      interval = setInterval(() => {
        if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const time = playerRef.current.getCurrentTime();
            if (onTimeUpdateRef.current && !isNaN(time)) {
              onTimeUpdateRef.current(time);
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, useIframeFallback]);

  return (
    <>
      {/* 
        Native HTML5 Audio element:
        Plays direct audio stream from /api/stream?id=...
        Mobile OS (Android & iOS) NEVER pauses direct HTML5 audio when pressing Home or locking screen!
      */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          if (!useIframeFallback && onTimeUpdateRef.current) {
            const t = e.currentTarget.currentTime;
            if (!isNaN(t)) {
              onTimeUpdateRef.current(t);
            }
          }
        }}
        onEnded={() => {
          if (!useIframeFallback && onEndedRef.current) {
            onEndedRef.current();
          }
        }}
        onError={(e) => {
          const src = audioRef.current?.getAttribute('src');
          if (!src || !currentSong?.id) return;
          console.warn('[SyncTune Native Audio] Stream error, switching to fallback:', e);
          setUseIframeFallback(true);
        }}
        style={{ display: 'none' }}
      />

      {/* Backup YouTube Iframe Engine container (only rendered if fallback is actively triggered) */}
      {useIframeFallback && (
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
      )}
    </>
  );
}
