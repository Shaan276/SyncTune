'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tv, Minimize2 } from 'lucide-react';

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

  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);

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
  const reloadVideoWithVoiceRef = useRef(null);

  // Dedicated function to reload the video stream from YouTube CDN so voice is guaranteed to play
  const reloadVideoWithVoice = useCallback((forcedTime) => {
    if (!playerRef.current || !isReadyRef.current || !currentSongRef.current?.id) return;
    try {
      const targetTime = typeof forcedTime === 'number' ? forcedTime : (currentTimeRef.current || 0);
      playerRef.current.loadVideoById({
        videoId: currentSongRef.current.id,
        startSeconds: Math.max(0, targetTime),
        suggestedQuality: 'small'
      });
      playerRef.current.unMute();
      playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
      playerRef.current.playVideo();
    } catch (e) {
      console.warn('Error reloading YouTube video stream:', e);
    }
  }, []);

  reloadVideoWithVoiceRef.current = reloadVideoWithVoice;

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
      // 0. Configure iOS Audio Session API for background playback
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'playback';
        } catch (e) {}
      }

      // 1. Initialize Web Audio API AudioContext with live MediaStream
      let ctx = audioContextRef.current;
      try {
        if (!ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            ctx = new AudioContextClass();
            audioContextRef.current = ctx;
          }
        }

        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }

          // Attach continuous live MediaStream to audio element to keep OS audio session active
          const audio = silentAudioRef.current;
          if (audio && !audio.srcObject && typeof ctx.createMediaStreamDestination === 'function') {
            const dest = ctx.createMediaStreamDestination();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001; // inaudible amplitude
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            audio.srcObject = dest.stream;
          }

          if (audio && isPlayingRef.current) {
            audio.play().catch(() => {});
          }
        }
      } catch (e) {}

      // If YouTube player is already initialized and supposed to play, ensure it is unmuted
      if (playerRef.current && isReadyRef.current && isPlayingRef.current) {
        try {
          playerRef.current.unMute();
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
  }, []);

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

        // Lock Screen Play: Explicitly triggers resume
        navigator.mediaSession.setActionHandler('play', () => {
          if (playerRef.current && isReadyRef.current) {
            try {
              playerRef.current.unMute();
              playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
              playerRef.current.playVideo();
            } catch (e) {}
          }
          if (silentAudioRef.current) {
            silentAudioRef.current.play().catch(() => {});
          }
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          if (onPlayRef.current) {
            onPlayRef.current();
          } else if (onTogglePlayRef.current) {
            onTogglePlayRef.current();
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        });

        // Lock Screen Pause: Explicitly triggers pause
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
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
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
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, isPlaying, duration]);

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
              // Ensure voice is unmuted whenever video enters playing state
              try {
                event.target.unMute();
                event.target.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
              } catch (e) {}

              if (silentAudioRef.current && silentAudioRef.current.paused) {
                silentAudioRef.current.play().catch(() => {});
              }
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              // If tab is visible and React state is paused, update media session
              if (document.visibilityState === 'visible' && !isPlayingRef.current) {
                if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'paused';
                }
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
          const songToPlay = songId || currentSongRef.current?.id;
          if (songToPlay) {
            if (songToPlay !== lastSongIdRef.current) {
              playerRef.current.loadVideoById({
                videoId: songToPlay,
                startSeconds: 0,
                suggestedQuality: 'small'
              });
              lastSongIdRef.current = songToPlay;
            }
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
            playerRef.current.playVideo();
          }
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
          playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
          playerRef.current.playVideo();
        } catch (e) {}
      }
    };

    // 5. Visibility Handler: Seamlessly resume playback and restore volume when returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        if (silentAudioRef.current && isPlayingRef.current) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (isPlayingRef.current && playerRef.current && isReadyRef.current) {
          try {
            playerRef.current.unMute();
            playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
            playerRef.current.playVideo();
          } catch (e) {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
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

            // Auto-unmute voice if player ever gets muted
            if (isPlayingRef.current && playerRef.current) {
              try {
                if (typeof playerRef.current.isMuted === 'function' && playerRef.current.isMuted()) {
                  playerRef.current.unMute();
                  playerRef.current.setVolume(Math.floor((volumeRef.current || 0.8) * 100));
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <>
      {/* Active HTML5 audio carrier element for OS media pipeline */}
      <audio
        ref={silentAudioRef}
        loop
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          bottom: -100,
          right: -100,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none'
        }}
      />

      {/* YouTube Video Player & Floating Mini-Player (same way YouTube does) */}
      <div
        className={`fixed z-30 transition-all duration-300 ${
          isMiniPlayerOpen
            ? 'bottom-20 right-3 sm:bottom-24 sm:right-6 w-52 h-32 sm:w-72 sm:h-44 shadow-2xl rounded-2xl border border-emerald-500/30 bg-black/95 overflow-hidden'
            : 'bottom-0 right-0 w-[240px] h-[180px] opacity-[0.001] pointer-events-none -z-10'
        }`}
      >
        {isMiniPlayerOpen && (
          <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between z-10 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-white tracking-wider uppercase">YouTube Video</span>
            </div>
            <button
              onClick={() => setIsMiniPlayerOpen(false)}
              className="p-1 rounded-full bg-black/70 text-zinc-300 hover:text-white border border-white/10 transition-colors"
              title="Minimize Video (Audio Only)"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div id="synctune-ultra-low-audio-engine" className="w-full h-full" />
      </div>

      {/* Floating Toggle Pill when Mini-Player is closed and song is playing */}
      {!isMiniPlayerOpen && currentSong?.id && (
        <button
          onClick={() => setIsMiniPlayerOpen(true)}
          className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#141C30]/90 hover:bg-[#1e2a48] border border-white/10 hover:border-emerald-500/40 text-zinc-300 hover:text-white shadow-lg backdrop-blur-md transition-all text-xs font-semibold cursor-pointer group"
          title="Watch YouTube Video Stream"
        >
          <Tv className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] hidden xs:inline">Watch Video</span>
        </button>
      )}
    </>
  );
}
