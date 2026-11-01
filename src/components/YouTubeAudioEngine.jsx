'use client';
import React, { useEffect, useRef, useState } from 'react';

// Valid 352-byte silent MP3 frame data URI to keep mobile OS audio session active during background playback
const SILENT_AUDIO_URI = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAA';

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
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const useIframeFallbackRef = useRef(false);
  useIframeFallbackRef.current = useIframeFallback;

  const pendingSongIdRef = useRef(null);
  const pendingSeekTimeRef = useRef(0);
  const playWatchdogRef = useRef(null);
  const nativeAudioStartedRef = useRef(false);
  const audioContextRef = useRef(null);

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

      // Unlock HTML5 Audio element
      const audio = audioRef.current;
      if (audio && isPlayingRef.current && !useIframeFallbackRef.current) {
        audio.play().catch(() => {});
      }
      const silent = silentAudioRef.current;
      if (silent) {
        silent.play().catch(() => {});
      }

      // Unlock Web Audio API context without oscillator to avoid stealing audio focus / muting media
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioContextRef.current = new AudioContextClass();
          }
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (e) {}

      if (useIframeFallbackRef.current && playerRef.current && isReadyRef.current && isPlayingRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    window.syncTuneUnlockAudio = unlockAudioSession;

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

  // Helper: Initialize or recreate YouTube player with a VALID video ID and start timestamp
  const initPlayer = (songId, startSeconds = 0) => {
    const targetId = songId || pendingSongIdRef.current || currentSongRef.current?.id;
    if (!targetId || typeof window === 'undefined') return;

    const initialSeek = typeof startSeconds === 'number' && startSeconds > 0 ? startSeconds : (pendingSeekTimeRef.current || 0);
    if (initialSeek > 0) {
      pendingSeekTimeRef.current = initialSeek;
    }

    if (!window.YT || !window.YT.Player) {
      pendingSongIdRef.current = targetId;
      return;
    }

    let el = document.getElementById('synctune-ultra-low-audio-engine');
    if (!el) {
      const wrapper = document.getElementById('synctune-yt-wrapper');
      if (!wrapper) return;
      el = document.createElement('div');
      el.id = 'synctune-ultra-low-audio-engine';
      wrapper.appendChild(el);
    }

    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
      isReadyRef.current = false;
      const wrapper = document.getElementById('synctune-yt-wrapper');
      if (wrapper && !document.getElementById('synctune-ultra-low-audio-engine')) {
        const freshEl = document.createElement('div');
        freshEl.id = 'synctune-ultra-low-audio-engine';
        wrapper.appendChild(freshEl);
      }
    }

    try {
      playerRef.current = new window.YT.Player('synctune-ultra-low-audio-engine', {
        height: '180',
        width: '240',
        videoId: targetId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(initialSeek || 0),
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
              event.target.setVolume(Math.floor(volumeRef.current * 100));
              event.target.unMute();

              const latestSongId = pendingSongIdRef.current || currentSongRef.current?.id;
              const targetSeek = pendingSeekTimeRef.current || initialSeek || 0;

              if (latestSongId && latestSongId !== targetId) {
                event.target.loadVideoById({
                  videoId: latestSongId,
                  startSeconds: targetSeek
                });
              } else if (targetSeek > 0) {
                event.target.seekTo(targetSeek, true);
              }

              if (isPlayingRef.current) {
                event.target.unMute();
                event.target.setVolume(Math.floor(volumeRef.current * 100));
                event.target.playVideo();
              }
              pendingSongIdRef.current = null;
              pendingSeekTimeRef.current = 0;
            } catch (e) {}
          },
          onError: (event) => {
            console.warn('[SyncTune YT Engine] Player error code:', event.data);
            if (event.data === 101 || event.data === 150 || event.data === 100 || event.data === 2) {
              if (onEndedRef.current) {
                onEndedRef.current();
              }
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              try {
                event.target.unMute();
                event.target.setVolume(Math.floor(volumeRef.current * 100));
              } catch (e) {}
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
                updatePositionState();
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              if (isPlayingRef.current) {
                try {
                  if (silentAudioRef.current && silentAudioRef.current.paused) {
                    silentAudioRef.current.play().catch(() => {});
                  }
                  if (playerRef.current) {
                    playerRef.current.unMute();
                    playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
                    playerRef.current.playVideo();
                  }
                } catch (e) {}

                setTimeout(() => {
                  try {
                    if (isPlayingRef.current && playerRef.current) {
                      const state = playerRef.current.getPlayerState();
                      if (state === 2) {
                        playerRef.current.unMute();
                        playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
                        playerRef.current.playVideo();
                      }
                    }
                  } catch (e) {}
                }, 40);
              } else if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
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
    } catch (e) {
      console.warn('[SyncTune YT Engine] initPlayer creation error:', e);
    }
  };

  // Helper: Switch to pre-warmed YouTube Engine with timestamp support
  const playWithYouTubeEngine = (songId, startSeconds = 0) => {
    if (!songId) return;
    setUseIframeFallback(true);
    useIframeFallbackRef.current = true;
    pendingSongIdRef.current = songId;

    const initialSeek = typeof startSeconds === 'number' && startSeconds > 0 ? startSeconds : (pendingSeekTimeRef.current || 0);
    if (initialSeek > 0) {
      pendingSeekTimeRef.current = initialSeek;
    }

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
        playerRef.current.loadVideoById({
          videoId: songId,
          startSeconds: initialSeek
        });
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
        if (isPlayingRef.current) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.cueVideoById({
            videoId: songId,
            startSeconds: initialSeek
          });
        }
        pendingSongIdRef.current = null;
        pendingSeekTimeRef.current = 0;
      } catch (e) {
        console.warn('[SyncTune Audio] loadVideoById error, re-initializing player:', e);
        initPlayer(songId, initialSeek);
      }
    } else {
      initPlayer(songId, initialSeek);
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
          playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
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
            playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
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

  // 4. Pre-warm YouTube IFrame API script tag on mount
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

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevOnReady === 'function') prevOnReady();
      const target = pendingSongIdRef.current || currentSongRef.current?.id;
      if (target) {
        initPlayer(target);
      }
    };
  }, []);

  // Global helper methods
  useEffect(() => {
    window.syncTunePlayAudio = (songId, directAudioUrl = null, title = '', artist = '', startSeconds = 0) => {
      const initialSeek = typeof startSeconds === 'number' && startSeconds > 0 ? startSeconds : (pendingSeekTimeRef.current || 0);
      const isDirect = Boolean(directAudioUrl && typeof directAudioUrl === 'string' && directAudioUrl.startsWith('http'));

      const targetSrc = isDirect
        ? directAudioUrl
        : (songId ? `/api/stream?id=${encodeURIComponent(songId)}&title=${encodeURIComponent(title || currentSongRef.current?.title || '')}&artist=${encodeURIComponent(artist || currentSongRef.current?.artist || '')}` : null);

      if (targetSrc && audioRef.current) {
        setUseIframeFallback(false);
        useIframeFallbackRef.current = false;
        if (playerRef.current && isReadyRef.current) {
          try { playerRef.current.pauseVideo(); } catch (e) {}
        }
        pendingSeekTimeRef.current = initialSeek;
        if (lastSongIdRef.current !== songId) {
          lastSongIdRef.current = songId;
          audioRef.current.src = targetSrc;
        } else if (initialSeek > 0) {
          try {
            audioRef.current.currentTime = initialSeek;
          } catch (e) {}
        }
        audioRef.current.volume = volumeRef.current;
        audioRef.current.play().catch(() => {});
      } else {
        playWithYouTubeEngine(songId || currentSongRef.current?.id, initialSeek);
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
      const seekTarget = Math.max(0, Number(targetSeconds) || 0);
      pendingSeekTimeRef.current = seekTarget;

      if (audioRef.current && !useIframeFallbackRef.current) {
        try {
          audioRef.current.currentTime = seekTarget;
          if (isPlayingRef.current) {
            audioRef.current.play().catch(() => {});
          }
        } catch (e) {}
      }
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(seekTarget, true);
          pendingSeekTimeRef.current = 0;
          if (isPlayingRef.current) {
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
            playerRef.current.playVideo();
          }
        } catch (e) {}
      }
    };

    // Lifecycle: Ensure playback continues unmuted on visibility change or page minimize
    const handleVisibilityChange = () => {
      if (isPlayingRef.current) {
        try {
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            silentAudioRef.current.play().catch(() => {});
          }
          if (audioRef.current && !useIframeFallbackRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
          if (useIframeFallbackRef.current && playerRef.current) {
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
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

  // 5. Track change handler: Native direct audio first with 2.5s fast watchdog to YouTube engine
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
      const initialSeek = Number(currentSong.initialSeekTime ?? currentTime) || 0;

      const targetSrc = hasDirectAudio
        ? currentSong.audioUrl
        : `/api/stream?id=${encodeURIComponent(currentSong.id)}&title=${encodeURIComponent(currentSong.title || '')}&artist=${encodeURIComponent(currentSong.artist || '')}`;

      setUseIframeFallback(false);
      useIframeFallbackRef.current = false;
      if (playerRef.current && isReadyRef.current) {
        try { playerRef.current.pauseVideo(); } catch (e) {}
      }

      if (audioRef.current) {
        pendingSeekTimeRef.current = initialSeek;
        audioRef.current.src = targetSrc;
        audioRef.current.volume = volumeRef.current;
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.warn('[SyncTune Audio] Direct play deferred:', err);
          });

          // 7s watchdog: only fallback if stream is not a direct CDN URL
          if (!hasDirectAudio) {
            playWatchdogRef.current = setTimeout(() => {
              if (!nativeAudioStartedRef.current && isPlayingRef.current && !useIframeFallbackRef.current) {
                console.warn('[SyncTune Audio] Failover to YouTube iframe after timeout');
                playWithYouTubeEngine(currentSong.id, initialSeek);
              }
            }, 7000);
          }
        }
      }
    }
  }, [currentSong?.id, currentSong?.audioUrl, currentSong?.title, currentSong?.artist, currentSong?.playTrigger, volume, isPlaying]);

  // 6. Volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (playerRef.current && isReadyRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(Math.floor(volume * 100));
      } catch (e) {}
    }
  }, [volume]);

  // 7. Time tracking for iframe fallback (native audio uses onTimeUpdate event directly)
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const time = playerRef.current.getCurrentTime();
            if (useIframeFallback && onTimeUpdateRef.current && !isNaN(time)) {
              onTimeUpdateRef.current(time);
              if (isPlayingRef.current) {
                updatePositionState(time);
              }
            }

            // Auto-resume if mobile OS or browser attempted to pause or mute in background
            if (isPlayingRef.current) {
              const state = playerRef.current.getPlayerState();
              if (state === 2) {
                playerRef.current.unMute();
                playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
                playerRef.current.playVideo();
              } else if (state === 1 && typeof playerRef.current.isMuted === 'function' && playerRef.current.isMuted()) {
                playerRef.current.unMute();
                playerRef.current.setVolume(Math.floor(volumeRef.current * 100));
              }
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, useIframeFallback, volume]);

  return (
    <>
      {/* Native HTML5 Audio element for direct vocal CDN streams (unmuted in mobile background) */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          if (pendingSeekTimeRef.current > 0) {
            try {
              e.currentTarget.currentTime = pendingSeekTimeRef.current;
            } catch (err) {}
            pendingSeekTimeRef.current = 0;
          }
        }}
        onCanPlay={(e) => {
          if (pendingSeekTimeRef.current > 0) {
            try {
              e.currentTarget.currentTime = pendingSeekTimeRef.current;
            } catch (err) {}
            pendingSeekTimeRef.current = 0;
          }
          if (isPlayingRef.current && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }}
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
          if (!src || !currentSongRef.current?.id) return;
          console.warn('[SyncTune Native Audio] Stream error event, switching to fallback:', e);
          playWithYouTubeEngine(currentSongRef.current.id, currentTime);
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

      {/* Real HTML5 audio carrier element unlocked by user interaction to keep mobile OS audio session active */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
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

      {/* YouTube Engine container: standard 240x180 geometry with opacity 0.001 (NOT scale 0.001) to satisfy Chrome's render tree and unmuted audio authorization */}
      <div
        id="synctune-yt-wrapper"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '240px',
          height: '180px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1
        }}
      >
        <div id="synctune-ultra-low-audio-engine" className="w-full h-full" />
      </div>
    </>
  );
}
