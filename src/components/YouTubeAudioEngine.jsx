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

  const pendingSongIdRef = useRef(null);
  const playWatchdogRef = useRef(null);
  const nativeAudioStartedRef = useRef(false);

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

  // 1. Synchronously Unlock Audio Pipeline on User Interaction (iOS Safari, iOS Chrome & Android Chrome)
  useEffect(() => {
    const unlockAudioSession = () => {
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'playback';
        } catch (e) {}
      }

      const audio = audioRef.current;
      if (audio && isPlayingRef.current && !useIframeFallbackRef.current) {
        audio.play().catch(() => {});
      }
      const silent = silentAudioRef.current;
      if (silent) {
        silent.play().catch(() => {});
      }

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

  // Helper: Switch immediately to pre-warmed YouTube Engine
  const playWithYouTubeEngine = (songId) => {
    if (!songId) return;
    setUseIframeFallback(true);
    useIframeFallbackRef.current = true;
    pendingSongIdRef.current = songId;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
    }

    if (silentAudioRef.current && isPlayingRef.current) {
      silentAudioRef.current.play().catch(() => {});
    }

    if (playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.floor(volume * 100));
        if (isPlayingRef.current) {
          playerRef.current.loadVideoById({ videoId: songId, startSeconds: 0 });
          playerRef.current.playVideo();
        } else {
          playerRef.current.cueVideoById({ videoId: songId, startSeconds: 0 });
        }
        pendingSongIdRef.current = null;
      } catch (e) {
        console.warn('[SyncTune Audio] loadVideoById error:', e);
      }
    }

    // Direct postMessage dispatch for instant browser playback
    const iframe = document.querySelector('#synctune-ultra-low-audio-engine iframe');
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'loadVideoById',
          args: [{ videoId: songId, startSeconds: 0 }]
        }), '*');
        if (isPlayingRef.current) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'playVideo',
            args: []
          }), '*');
        }
      } catch (e) {}
    }
  };

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
    if (!isPlayingRef.current) return;
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

  // Synchronize MediaSession playbackState and position
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (isPlaying) {
        updatePositionState(currentTime);
      }
    } catch (e) {}
  }, [isPlaying, duration]);

  // 4. Pre-warm YouTube IFrame API ON MOUNT (Zero-latency fallback)
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
      const el = document.getElementById('synctune-ultra-low-audio-engine');
      if (!el) return;

      playerRef.current = new window.YT.Player('synctune-ultra-low-audio-engine', {
        height: '240',
        width: '320',
        videoId: currentSong?.id || '7wtfhZwyrcc',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          enablejsapi: 1,
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
              const songToLoad = pendingSongIdRef.current || (useIframeFallbackRef.current && currentSong?.id);
              if (songToLoad) {
                if (isPlayingRef.current) {
                  event.target.loadVideoById({ videoId: songToLoad, startSeconds: 0 });
                  event.target.playVideo();
                } else {
                  event.target.cueVideoById({ videoId: songToLoad, startSeconds: 0 });
                }
                pendingSongIdRef.current = null;
              }
            } catch (e) {}
          },
          onError: (event) => {
            console.warn('[SyncTune YT Engine] Player error code:', event.data);
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
      const isDirect = Boolean(directAudioUrl && typeof directAudioUrl === 'string' && directAudioUrl.startsWith('http'));
      if (isDirect) {
        setUseIframeFallback(false);
        useIframeFallbackRef.current = false;
        if (playerRef.current && isReadyRef.current) {
          try { playerRef.current.pauseVideo(); } catch (e) {}
        }
        if (audioRef.current) {
          if (songId && songId !== lastSongIdRef.current) {
            lastSongIdRef.current = songId;
            audioRef.current.src = directAudioUrl;
          }
          audioRef.current.volume = volume;
          audioRef.current.play().catch(() => {});
        }
      } else {
        playWithYouTubeEngine(songId || currentSong?.id);
      }
    };

    window.syncTunePauseAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (playerRef.current && isReadyRef.current) {
        try { playerRef.current.pauseVideo(); } catch (e) {}
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
          if (isPlayingRef.current) {
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
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, [volume, currentSong?.audioUrl, currentSong?.title, currentSong?.artist]);

  // 5. Track change handler: Native audio for direct streams, instant YouTube engine for YouTube tracks
  useEffect(() => {
    if (!currentSong?.id) return;

    const isNewSong = currentSong.id !== lastSongIdRef.current;
    const isExplicitNewPlay = Boolean(currentSong.playTrigger && currentSong.playTrigger !== lastPlayTriggerRef.current);

    if (isNewSong || isExplicitNewPlay) {
      lastSongIdRef.current = currentSong.id;
      lastPlayTriggerRef.current = currentSong.playTrigger || Date.now();
      nativeAudioStartedRef.current = false;
      if (playWatchdogRef.current) {
        clearTimeout(playWatchdogRef.current);
        playWatchdogRef.current = null;
      }

      const hasDirectAudio = Boolean(currentSong.audioUrl && typeof currentSong.audioUrl === 'string' && currentSong.audioUrl.startsWith('http'));

      if (hasDirectAudio) {
        // High-speed Akamai 320kbps MP4 CDN (plays in 50ms)
        setUseIframeFallback(false);
        useIframeFallbackRef.current = false;
        if (playerRef.current && isReadyRef.current) {
          try { playerRef.current.pauseVideo(); } catch (e) {}
        }
        if (audioRef.current) {
          audioRef.current.src = currentSong.audioUrl;
          audioRef.current.volume = volume;
          if (isPlaying) {
            audioRef.current.play().catch((err) => {
              console.warn('[SyncTune Audio] Direct play deferred:', err);
            });
          }
        }
      } else {
        // YouTube track (e.g. Olivia Rodrigo - deja vu, Imagine Dragons - Believer)
        // Immediately start on YouTube Engine without failing on server proxy!
        playWithYouTubeEngine(currentSong.id);
      }
    }
  }, [currentSong?.id, currentSong?.audioUrl, currentSong?.title, currentSong?.artist, currentSong?.playTrigger, volume, isPlaying]);

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
      {/* Native HTML5 Audio element for direct CDN streams */}
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
          playWithYouTubeEngine(currentSong.id);
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

      {/* Pre-warmed YouTube Engine container (always in DOM so warm player is ready in 0ms) */}
      <div
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '320px',
          height: '240px',
          visibility: 'visible',
          pointerEvents: 'none',
          zIndex: -1
        }}
      >
        <div id="synctune-ultra-low-audio-engine" />
      </div>
    </>
  );
}
