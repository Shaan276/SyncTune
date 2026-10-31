'use client';
import React, { useEffect, useRef, useState } from 'react';

// 44-byte silent WAV data URI to keep mobile OS audio session active during background playback
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
  const audioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);
  const lastSongIdRef = useRef(null);
  const lastPlayTriggerRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const useIframeFallbackRef = useRef(false);
  useIframeFallbackRef.current = useIframeFallback;

  // Ultra-fast failover watchdog refs
  const playWatchdogRef = useRef(null);
  const nativeAudioStartedRef = useRef(false);
  const lastIframeSongIdRef = useRef(null);

  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onTogglePlayRef = useRef(onTogglePlay);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPrevRef = useRef(onSkipPrev);
  const onSeekRef = useRef(onSeek);

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

  // Fast switch to pre-warmed YouTube Iframe Engine (sub-second playback)
  const switchToIframe = (songId) => {
    if (!songId) return;
    if (useIframeFallbackRef.current && lastIframeSongIdRef.current === songId) {
      return;
    }
    console.log('[SyncTune Audio] Activating pre-warmed YouTube Engine for:', songId);
    lastIframeSongIdRef.current = songId;
    useIframeFallbackRef.current = true;
    setUseIframeFallback(true);

    // Stop native audio to avoid duplicate playback
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      } catch (e) {}
    }

    // Keep silent carrier alive to preserve mobile background audio session
    if (silentAudioRef.current && isPlayingRef.current) {
      silentAudioRef.current.play().catch(() => {});
    }

    if (playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.floor(volume * 100));
        if (isPlayingRef.current) {
          playerRef.current.loadVideoById(songId, 0);
          playerRef.current.playVideo();
        } else {
          playerRef.current.cueVideoById(songId, 0);
        }
      } catch (e) {
        console.warn('[SyncTune Iframe Engine] loadVideoById error:', e);
      }
    }
  };

  // 1. Synchronously Unlock Audio Pipeline on User Interaction (iOS Safari, iOS Chrome & Android Chrome)
  useEffect(() => {
    const unlockAudioSession = () => {
      // AudioSession API for iOS WebKit
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'playback';
        } catch (e) {}
      }

      // Unlock Native HTML5 Audio & Silent Carrier Loop
      const audio = audioRef.current;
      if (audio && isPlayingRef.current) {
        audio.play().catch(() => {});
      }
      const silent = silentAudioRef.current;
      if (silent) {
        silent.play().catch(() => {});
      }

      // Unlock YouTube iframe fallback if active
      if (useIframeFallbackRef.current && playerRef.current && isReadyRef.current && isPlayingRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volume * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
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

    const silent = silentAudioRef.current;
    if (silent) {
      if (isPlaying) {
        silent.play().catch(() => {});
      } else {
        silent.pause();
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
  }, [isPlaying, useIframeFallback, volume]);

  // Helper: Synchronize MediaSession position state strictly per W3C spec (playbackRate must be > 0)
  const updatePositionState = (explicitPos) => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!isPlayingRef.current) return; // W3C Spec: setPositionState must NEVER be called with playbackRate <= 0
    let d = audioRef.current?.duration || duration;
    if ((!d || isNaN(d) || d <= 0) && playerRef.current && typeof playerRef.current.getDuration === 'function') {
      try {
        d = playerRef.current.getDuration();
      } catch (e) {}
    }
    if (!d || isNaN(d) || d <= 0) return;
    let pos = explicitPos !== undefined ? explicitPos : (audioRef.current?.currentTime || currentTime);
    if ((pos === undefined || isNaN(pos)) && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        pos = playerRef.current.getCurrentTime();
      } catch (e) {}
    }
    if (isNaN(pos) || pos < 0 || pos > d) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(1, d),
        playbackRate: 1.0,
        position: pos
      });
    } catch (err) {}
  };

  // 3. MediaSession API metadata & action handlers (Persistent notification while paused)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentSong) return;

    try {
      const artworkUrl = currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.id}/hqdefault.jpg`;
      
      // Allocate metadata once per track. Never reset or wipe on pause.
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title || 'SyncTune Track',
        artist: currentSong.artist || 'SyncTune Artist',
        album: 'SyncTune Audio OS',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.playbackState = isPlayingRef.current ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current && !useIframeFallbackRef.current) {
          audioRef.current.play().catch(() => {});
        }
        if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(() => {});
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
          updatePositionState();
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
        if (silentAudioRef.current) {
          silentAudioRef.current.pause();
        }
        if (playerRef.current && isReadyRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch (e) {}
        }
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          // W3C compliant: set playbackState to 'paused' without calling setPositionState(rate: 0)
          // This keeps the iOS Lock Screen & Android notification active with the Play button visible
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
          if (audioRef.current && !useIframeFallbackRef.current) {
            audioRef.current.currentTime = details.seekTime;
          }
          if (onSeekRef.current) onSeekRef.current(details.seekTime);
          if (window.syncTuneSeekAudio) window.syncTuneSeekAudio(details.seekTime);
          updatePositionState(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        const current = audioRef.current?.currentTime || currentTime || 0;
        const target = Math.min(duration || 1000, current + skipTime);
        if (window.syncTuneSeekAudio) window.syncTuneSeekAudio(target);
        updatePositionState(target);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        const current = audioRef.current?.currentTime || currentTime || 0;
        const target = Math.max(0, current - skipTime);
        if (window.syncTuneSeekAudio) window.syncTuneSeekAudio(target);
        updatePositionState(target);
      });
    } catch (err) {}
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.thumbnail]);

  // Synchronize MediaSession playbackState and position without touching metadata or violating W3C spec
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (isPlaying) {
        updatePositionState(currentTime);
      }
    } catch (e) {}
  }, [isPlaying, duration]);

  // 4. Pre-warm YouTube IFrame API ON MOUNT (Zero-latency fallback ready in background)
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      const container = document.getElementById('synctune-ultra-low-audio-engine');
      if (!container) return;

      playerRef.current = new window.YT.Player('synctune-ultra-low-audio-engine', {
        height: '240',
        width: '320',
        videoId: currentSong?.id || '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          playsinline: 1,
          suggestedQuality: 'small',
          origin: window.location.origin
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
              if (useIframeFallbackRef.current && isPlayingRef.current && currentSong?.id) {
                event.target.loadVideoById(currentSong.id, 0);
                event.target.playVideo();
              }
            } catch (e) {}
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
                updatePositionState();
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
              }
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (useIframeFallbackRef.current && onEndedRef.current) {
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
  }, []);

  // Global helper methods
  useEffect(() => {
    window.syncTunePlayAudio = (songId, directAudioUrl = null, title = '', artist = '') => {
      if (playWatchdogRef.current) {
        clearTimeout(playWatchdogRef.current);
        playWatchdogRef.current = null;
      }
      nativeAudioStartedRef.current = false;
      setUseIframeFallback(false);
      useIframeFallbackRef.current = false;

      if (audioRef.current) {
        if (songId && songId !== lastSongIdRef.current) {
          lastSongIdRef.current = songId;
          lastPlayTriggerRef.current = Date.now();
          const targetSrc = (directAudioUrl && typeof directAudioUrl === 'string' && directAudioUrl.startsWith('http'))
            ? directAudioUrl
            : `/api/stream?id=${encodeURIComponent(songId)}&title=${encodeURIComponent(title || currentSong?.title || '')}&artist=${encodeURIComponent(artist || currentSong?.artist || '')}`;
          audioRef.current.src = targetSrc;
        }
        audioRef.current.volume = volume;
        audioRef.current.play().catch(() => {});

        // 800ms fast failover watchdog
        playWatchdogRef.current = setTimeout(() => {
          if (!nativeAudioStartedRef.current && isPlayingRef.current && !useIframeFallbackRef.current) {
            console.log('[SyncTune Watchdog] Native stream not active in 800ms, triggering fast switch');
            switchToIframe(songId);
          }
        }, 800);
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
          if (audioRef.current && !useIframeFallbackRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
          if (useIframeFallbackRef.current && playerRef.current) {
            if (silentAudioRef.current && silentAudioRef.current.paused) {
              silentAudioRef.current.play().catch(() => {});
            }
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
      if (playWatchdogRef.current) {
        clearTimeout(playWatchdogRef.current);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, [volume, currentSong?.audioUrl, currentSong?.title, currentSong?.artist]);

  // 5. Track change handler: ONLY load new source if the song ID changed OR an explicit new play was triggered
  useEffect(() => {
    if (!currentSong?.id) return;

    const isNewSong = currentSong.id !== lastSongIdRef.current;
    const isExplicitNewPlay = Boolean(currentSong.playTrigger && currentSong.playTrigger !== lastPlayTriggerRef.current);

    if (isNewSong || isExplicitNewPlay) {
      lastSongIdRef.current = currentSong.id;
      lastPlayTriggerRef.current = currentSong.playTrigger || Date.now();
      
      if (playWatchdogRef.current) {
        clearTimeout(playWatchdogRef.current);
        playWatchdogRef.current = null;
      }
      nativeAudioStartedRef.current = false;
      setUseIframeFallback(false);
      useIframeFallbackRef.current = false;

      // Stop previous video on iframe if running
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.pauseVideo();
        } catch (e) {}
      }

      if (audioRef.current) {
        const targetSrc = (currentSong.audioUrl && typeof currentSong.audioUrl === 'string' && currentSong.audioUrl.startsWith('http'))
          ? currentSong.audioUrl
          : `/api/stream?id=${encodeURIComponent(currentSong.id)}&title=${encodeURIComponent(currentSong.title || '')}&artist=${encodeURIComponent(currentSong.artist || '')}`;
        audioRef.current.src = targetSrc;
        audioRef.current.volume = volume;
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.warn('[SyncTune Audio] Direct play deferred:', err);
          });

          // 800ms fast failover watchdog
          playWatchdogRef.current = setTimeout(() => {
            if (!nativeAudioStartedRef.current && isPlayingRef.current && !useIframeFallbackRef.current) {
              console.log('[SyncTune Watchdog] Native stream not active in 800ms, triggering fast switch');
              switchToIframe(currentSong.id);
            }
          }, 800);
        }
      }
    }
  }, [currentSong?.id, currentSong?.audioUrl, currentSong?.title, currentSong?.artist, currentSong?.playTrigger, volume]);

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
              if (isPlayingRef.current) {
                updatePositionState(time);
              }
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
        Plays direct audio stream from Akamai CDN (SoundCloud model) or /api/stream?id=...
        Rendered with active layout geometry (not display: none) so iOS WebKit and Android Blink
        never cull or suspend the element when Chrome / Safari is backgrounded.
      */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onPlaying={() => {
          nativeAudioStartedRef.current = true;
          if (playWatchdogRef.current) {
            clearTimeout(playWatchdogRef.current);
            playWatchdogRef.current = null;
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
            updatePositionState();
          }
        }}
        onTimeUpdate={(e) => {
          if (!useIframeFallback && onTimeUpdateRef.current) {
            const t = e.currentTarget.currentTime;
            if (!isNaN(t)) {
              if (!nativeAudioStartedRef.current && t > 0) {
                nativeAudioStartedRef.current = true;
                if (playWatchdogRef.current) {
                  clearTimeout(playWatchdogRef.current);
                  playWatchdogRef.current = null;
                }
              }
              onTimeUpdateRef.current(t);
              if (isPlayingRef.current) {
                updatePositionState(t);
              }
            }
          }
        }}
        onPlay={() => {
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
            updatePositionState();
          }
        }}
        onPause={() => {
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        }}
        onEnded={() => {
          if (!useIframeFallback && onEndedRef.current) {
            onEndedRef.current();
          }
        }}
        onError={(e) => {
          if (playWatchdogRef.current) {
            clearTimeout(playWatchdogRef.current);
            playWatchdogRef.current = null;
          }
          const src = audioRef.current?.getAttribute('src');
          if (!src || !currentSong?.id) return;
          console.warn('[SyncTune Native Audio] Stream error event, switching to fallback:', e);
          switchToIframe(currentSong.id);
        }}
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />

      {/* Real HTML5 audio carrier element unlocked by user interaction to keep mobile OS audio session alive */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Pre-warmed YouTube Iframe Engine container (always in DOM so warm player is ready in 0ms) */}
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
          zIndex: 1,
          opacity: useIframeFallback ? 0.01 : 0
        }}
      >
        <div id="synctune-ultra-low-audio-engine" />
      </div>
    </>
  );
}
