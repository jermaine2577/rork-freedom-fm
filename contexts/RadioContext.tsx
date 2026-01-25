import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform, AppState, AppStateStatus } from 'react-native';

const STREAM_URL = 'https://castpanel.freedomfm1065.com/listen/freedom_fm_106.5/mobile.mp3';

const STREAM_TIMEOUT = 60000;
const MAX_RETRY_ATTEMPTS = 100;
const HEALTH_CHECK_INTERVAL = Platform.OS === 'android' ? 10000 : 30000;
const ANDROID_RECOVERY_DELAY = 1500;
const ANDROID_BUFFER_CHECK_INTERVAL = 5000;
const ANDROID_STALL_THRESHOLD = 8000;

interface RadioRefs {
  mounted: boolean;
  player: any;
  webAudio: HTMLAudioElement | null;
  audioSetup: boolean;
  isPlaying: boolean;
  isSwitching: boolean;
  pendingPlay: Promise<void> | null;
  playSessionId: number;
  healthCheck: ReturnType<typeof setInterval> | null;
  bufferCheck: ReturnType<typeof setInterval> | null;
  retryCount: number;
  lastPlaybackTime: number;
  isRecovering: boolean;
  playFn: (() => Promise<void>) | undefined;
  cleanupFn: (() => Promise<void>) | undefined;
  isInBackground: boolean;
  consecutiveErrors: number;
  lastSuccessfulPlay: number;
  lastBufferTime: number;
  stallCount: number;
  isBuffering: boolean;
}

let expoAudioModule: any = null;
let audioModuleLoaded = false;

const loadExpoAudio = (): boolean => {
  if (Platform.OS === 'web') return false;
  if (audioModuleLoaded && expoAudioModule) return true;
  
  try {
    expoAudioModule = require('expo-audio');
    audioModuleLoaded = true;
    console.log('[Radio] expo-audio module loaded successfully');
    return true;
  } catch (error) {
    console.warn('[Radio] expo-audio not available:', error);
    return false;
  }
};

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  
  const refs = useRef<RadioRefs>({
    mounted: true,
    player: null,
    webAudio: null,
    audioSetup: false,
    isPlaying: false,
    isSwitching: false,
    pendingPlay: null,
    playSessionId: 0,
    healthCheck: null,
    bufferCheck: null,
    retryCount: 0,
    lastPlaybackTime: 0,
    isRecovering: false,
    playFn: undefined,
    cleanupFn: undefined,
    isInBackground: false,
    consecutiveErrors: 0,
    lastSuccessfulPlay: Date.now(),
    lastBufferTime: Date.now(),
    stallCount: 0,
    isBuffering: false,
  });

  const getRetryDelay = useCallback(() => {
    const baseDelay = Platform.OS === 'android' ? ANDROID_RECOVERY_DELAY : 1500;
    const maxDelay = 10000;
    const multiplier = Math.min(refs.current.consecutiveErrors, 3);
    const exponentialDelay = baseDelay * Math.pow(1.3, multiplier);
    const jitter = Math.random() * 300;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }, []);

  const configureAudioMode = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    
    const moduleLoaded = loadExpoAudio();
    if (!moduleLoaded || !expoAudioModule?.setAudioModeAsync) return false;
    
    try {
      const audioConfig = Platform.OS === 'android' 
        ? {
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'duckOthers',
            interruptionModeAndroid: 'duckOthers',
          }
        : {
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'doNotMix',
            interruptionModeAndroid: 'doNotMix',
          };
      
      await expoAudioModule.setAudioModeAsync(audioConfig);
      console.log('[Radio] Audio mode configured for', Platform.OS);
      return true;
    } catch (err) {
      console.warn('[Radio] Error configuring audio mode:', err);
      return false;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (refs.current.healthCheck) {
      clearInterval(refs.current.healthCheck);
      refs.current.healthCheck = null;
    }
    if (refs.current.bufferCheck) {
      clearInterval(refs.current.bufferCheck);
      refs.current.bufferCheck = null;
    }
  }, []);

  const cleanupWebAudio = useCallback(() => {
    if (refs.current.webAudio) {
      console.log('[Radio] Cleaning up web audio...');
      try {
        refs.current.webAudio.pause();
        refs.current.webAudio.src = '';
        refs.current.webAudio.load();
      } catch (e) {
        console.warn('[Radio] Web audio cleanup error:', e);
      }
      refs.current.webAudio = null;
    }
  }, []);

  const cleanupPlayer = useCallback(async () => {
    clearAllTimers();

    if (Platform.OS === 'web') {
      cleanupWebAudio();
      return;
    }

    if (!refs.current.player) {
      return;
    }

    try {
      const player = refs.current.player;
      refs.current.player = null;

      console.log('[Radio] Cleaning up player...');

      try {
        if (player.playing) {
          player.pause();
        }
      } catch (pauseErr) {
        console.warn('[Radio] Error pausing player during cleanup:', pauseErr);
      }

      try {
        if (typeof player.stop === 'function') {
          player.stop();
        }
      } catch (stopErr) {
        console.warn('[Radio] Error stopping player during cleanup:', stopErr);
      }

      try {
        if (typeof player.unload === 'function') {
          await player.unload();
        }
      } catch (unloadErr) {
        console.warn('[Radio] Error unloading player during cleanup:', unloadErr);
      }

      try {
        if (typeof player.release === 'function') {
          player.release();
        }
      } catch (releaseErr) {
        console.warn('[Radio] Error releasing player during cleanup:', releaseErr);
      }

      console.log('[Radio] Player cleanup completed');
    } catch (e: any) {
      console.warn('[Radio] Error during player cleanup:', e?.message);
      refs.current.player = null;
    }
  }, [clearAllTimers, cleanupWebAudio]);

  const playWeb = useCallback(async () => {
    const startSessionId = ++refs.current.playSessionId;
    console.log('[Radio] Web play requested', { startSessionId });

    try {
      setIsLoading(true);
      setError(null);

      cleanupWebAudio();

      const streamUri = `${STREAM_URL}?t=${Date.now()}`;
      console.log('[Radio] Creating web audio for:', streamUri);

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'none';

      const playPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream connection timed out'));
        }, STREAM_TIMEOUT);

        audio.oncanplay = () => {
          console.log('[Radio] Web audio can play');
          clearTimeout(timeout);
        };

        audio.onplaying = () => {
          if (refs.current.playSessionId !== startSessionId) {
            console.log('[Radio] Web audio playing for old session, ignoring', {
              startSessionId,
              current: refs.current.playSessionId,
            });
            try {
              audio.pause();
            } catch {}
            return;
          }

          console.log('[Radio] Web audio playing');
          clearTimeout(timeout);
          refs.current.isPlaying = true;
          refs.current.lastSuccessfulPlay = Date.now();
          refs.current.consecutiveErrors = 0;
          if (refs.current.mounted) {
            setIsPlaying(true);
            setIsLoading(false);
            setError(null);
          }
          resolve();
        };

        audio.onwaiting = () => {
          if (refs.current.playSessionId !== startSessionId) return;
          console.log('[Radio] Web audio buffering...');
          if (refs.current.mounted) {
            setIsLoading(true);
          }
        };

        audio.onerror = () => {
          if (refs.current.playSessionId !== startSessionId) return;
          console.error('[Radio] Web audio error');
          clearTimeout(timeout);
          const errorMsg = 'Unable to load stream. Please check your connection.';
          if (refs.current.mounted) {
            setError(errorMsg);
            setIsLoading(false);
            setIsPlaying(false);
          }
          refs.current.isPlaying = false;
          reject(new Error(errorMsg));
        };

        audio.onended = () => {
          if (refs.current.playSessionId !== startSessionId) return;
          console.log('[Radio] Web audio stream ended');
          if (refs.current.isPlaying && refs.current.mounted && !refs.current.isRecovering) {
            refs.current.isRecovering = true;
            setTimeout(() => {
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }, 1000);
          }
        };

        audio.onpause = () => {
          if (refs.current.playSessionId !== startSessionId) return;
          if (!refs.current.isSwitching && !refs.current.isRecovering && refs.current.mounted) {
            refs.current.isPlaying = false;
            setIsPlaying(false);
          }
        };
      });

      audio.src = streamUri;
      audio.volume = volume;
      refs.current.webAudio = audio;

      await audio.play();
      await playPromise;

      refs.current.retryCount = 0;
    } catch (err: any) {
      console.error('[Radio] Web audio error:', err?.message || err);
      if (refs.current.mounted) {
        setError('Unable to play stream. Please try again.');
        refs.current.isPlaying = false;
        setIsPlaying(false);
        setIsLoading(false);
      }
      cleanupWebAudio();
    }
  }, [volume, cleanupWebAudio]);

  const play = useCallback(async () => {
    if (refs.current.pendingPlay) {
      console.log('[Radio] Play ignored: pending play in progress');
      return refs.current.pendingPlay;
    }

    const playPromise = (async () => {
      refs.current.isSwitching = true;
      const startSessionId = ++refs.current.playSessionId;

      if (Platform.OS === 'web') {
        try {
          await playWeb();
        } finally {
          refs.current.isSwitching = false;
        }
        return;
      }

      console.log('[Radio] Play requested, platform:', Platform.OS, { startSessionId });

      const moduleLoaded = loadExpoAudio();
      if (!moduleLoaded || !expoAudioModule) {
        console.error('[Radio] expo-audio module not loaded');
        setError('Audio module not available. Please restart the app.');
        setIsLoading(false);
        refs.current.isSwitching = false;
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        await configureAudioMode();
        await cleanupPlayer();

        if (refs.current.playSessionId !== startSessionId) {
          console.log('[Radio] Play aborted (session changed after cleanup)', {
            startSessionId,
            current: refs.current.playSessionId,
          });
          return;
        }

        if (Platform.OS === 'android') {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await configureAudioMode();
        }

        console.log('[Radio] Creating audio player...');

        const streamUri = `${STREAM_URL}?t=${Date.now()}`;

        const audioSource: any = {
          uri: streamUri,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Connection: 'keep-alive',
            Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.1',
            'Icy-MetaData': '0',
          },
        };

        let newPlayer: any = null;

        try {
          const createPlayerPromise = (async () => {
            const playerOptions =
              Platform.OS === 'android'
                ? {
                    updateInterval: 500,
                    shouldCorrectPitch: false,
                  }
                : {
                    updateInterval: 500,
                  };

            const player = expoAudioModule.createAudioPlayer(audioSource, playerOptions);
            return player;
          })();

          const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Stream connection timed out'));
            }, STREAM_TIMEOUT);
          });

          newPlayer = await Promise.race([createPlayerPromise, timeoutPromise]);

          if (!newPlayer) {
            throw new Error('Failed to create audio player');
          }
        } catch (createError: any) {
          console.error('[Radio] Error creating player:', createError?.message || createError);
          refs.current.consecutiveErrors++;
          const errorMsg = createError?.message?.includes('timed out')
            ? 'Stream connection timed out. Please try again.'
            : 'Unable to load stream. Please check your connection.';
          setError(errorMsg);
          setIsLoading(false);
          return;
        }

        if (refs.current.playSessionId !== startSessionId) {
          console.log('[Radio] New player created for old session; releasing immediately', {
            startSessionId,
            current: refs.current.playSessionId,
          });
          try {
            if (typeof newPlayer.release === 'function') {
              newPlayer.release();
            } else if (typeof newPlayer.unload === 'function') {
              await newPlayer.unload();
            }
          } catch (e) {
            console.warn('[Radio] Failed to release abandoned player:', e);
          }
          return;
        }

        refs.current.player = newPlayer;
        refs.current.lastSuccessfulPlay = Date.now();
        refs.current.consecutiveErrors = 0;
        console.log('[Radio] Player created successfully');

        newPlayer.addListener('playbackStatusUpdate', (status: any) => {
          if (!refs.current.mounted) return;
          if (refs.current.playSessionId !== startSessionId) return;

          if (status.playing) {
            refs.current.isPlaying = true;
            refs.current.isBuffering = false;
            refs.current.lastPlaybackTime = Date.now();
            refs.current.lastBufferTime = Date.now();
            refs.current.lastSuccessfulPlay = Date.now();
            refs.current.consecutiveErrors = 0;
            refs.current.stallCount = 0;
            setIsPlaying(true);
            setIsLoading(false);
            setError(null);
          } else if (status.isBuffering) {
            refs.current.isBuffering = true;
            refs.current.lastBufferTime = Date.now();
            setIsLoading(true);
            console.log('[Radio] Buffering...');
          } else if (status.didJustFinish) {
            console.log('[Radio] Stream ended, reconnecting...');
            if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
              refs.current.isRecovering = true;
              const delay = getRetryDelay();
              setTimeout(() => {
                if (refs.current.mounted && refs.current.playSessionId === startSessionId) {
                  refs.current.isRecovering = false;
                  refs.current.playFn?.();
                }
              }, delay);
            }
          } else if (!status.playing && !status.isBuffering && refs.current.isPlaying) {
            console.log('[Radio] Playback paused unexpectedly');
            if (Platform.OS === 'android' && !refs.current.isRecovering && refs.current.mounted) {
              refs.current.stallCount++;
              if (refs.current.stallCount >= 2) {
                console.log('[Radio] Multiple stalls detected, recovering...');
                refs.current.isRecovering = true;
                refs.current.stallCount = 0;
                setTimeout(async () => {
                  if (refs.current.mounted && refs.current.playSessionId === startSessionId) {
                    await cleanupPlayer();
                    refs.current.isRecovering = false;
                    refs.current.playFn?.();
                  }
                }, ANDROID_RECOVERY_DELAY);
              } else {
                try {
                  newPlayer.play();
                  console.log('[Radio] Attempting quick resume');
                } catch (e) {
                  console.warn('[Radio] Quick resume failed:', e);
                }
              }
            }
          }
        });

        newPlayer.volume = volume;
        newPlayer.play();

        console.log('[Radio] Play command sent, waiting for playback...');

        let playbackStarted = false;
        const maxWaitTime = 20000;
        const checkInterval = 500;
        let waitedTime = 0;

        while (
          !playbackStarted &&
          waitedTime < maxWaitTime &&
          refs.current.mounted &&
          refs.current.playSessionId === startSessionId
        ) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;

          if (newPlayer.playing || newPlayer.isBuffering) {
            playbackStarted = true;
            console.log('[Radio] Playback confirmed');
          }
        }

        if (!playbackStarted && refs.current.mounted && refs.current.playSessionId === startSessionId) {
          console.warn('[Radio] Playback not confirmed within timeout');
        }

        if (refs.current.healthCheck) {
          clearInterval(refs.current.healthCheck);
        }
        if (refs.current.bufferCheck) {
          clearInterval(refs.current.bufferCheck);
        }

        if (Platform.OS === 'android') {
          refs.current.bufferCheck = setInterval(() => {
            if (
              !refs.current.player ||
              !refs.current.isPlaying ||
              !refs.current.mounted ||
              refs.current.isRecovering ||
              refs.current.playSessionId !== startSessionId
            ) {
              return;
            }

            const player = refs.current.player;
            const timeSinceBuffer = Date.now() - refs.current.lastBufferTime;

            if (!player.playing && !player.isBuffering && timeSinceBuffer > ANDROID_STALL_THRESHOLD) {
              console.log('[Radio] Android stall detected, quick recovery...');
              try {
                player.play();
                refs.current.lastBufferTime = Date.now();
              } catch (e) {
                console.warn('[Radio] Quick play failed:', e);
              }
            }
          }, ANDROID_BUFFER_CHECK_INTERVAL);
        }

        refs.current.healthCheck = setInterval(async () => {
          if (
            !refs.current.player ||
            !refs.current.isPlaying ||
            !refs.current.mounted ||
            refs.current.playSessionId !== startSessionId
          ) {
            return;
          }

          if (refs.current.isRecovering) return;

          try {
            const player = refs.current.player;
            const timeSinceLastPlayback = Date.now() - refs.current.lastPlaybackTime;
            const stallThreshold = Platform.OS === 'android' ? 30000 : 60000;

            if (player.playing) {
              refs.current.lastPlaybackTime = Date.now();
              refs.current.lastBufferTime = Date.now();
              refs.current.lastSuccessfulPlay = Date.now();
              refs.current.retryCount = 0;
              refs.current.consecutiveErrors = 0;
              refs.current.stallCount = 0;
            } else if (player.isBuffering) {
              refs.current.lastPlaybackTime = Date.now();
              refs.current.lastBufferTime = Date.now();
            } else if (refs.current.isPlaying && timeSinceLastPlayback > stallThreshold) {
              console.log('[Radio] Stream appears stuck, attempting recovery...');

              try {
                player.play();
                await new Promise((resolve) => setTimeout(resolve, 2000));

                if (player.playing) {
                  console.log('[Radio] Recovery successful');
                  refs.current.lastPlaybackTime = Date.now();
                  refs.current.lastBufferTime = Date.now();
                  return;
                }
              } catch {
                // continue
              }

              if (
                refs.current.retryCount < MAX_RETRY_ATTEMPTS &&
                refs.current.mounted &&
                !refs.current.isRecovering &&
                refs.current.playSessionId === startSessionId
              ) {
                refs.current.retryCount++;
                refs.current.isRecovering = true;
                console.log('[Radio] Full reconnect attempt', refs.current.retryCount);
                await cleanupPlayer();
                const delay = getRetryDelay();
                await new Promise((resolve) => setTimeout(resolve, delay));
                if (refs.current.mounted && refs.current.playSessionId === startSessionId) {
                  refs.current.isRecovering = false;
                  refs.current.playFn?.();
                }
              }
            }
          } catch (healthErr) {
            console.warn('[Radio] Health check error:', healthErr);
          }
        }, HEALTH_CHECK_INTERVAL);

        refs.current.retryCount = 0;
        refs.current.isRecovering = false;
      } catch (err: any) {
        console.error('[Radio] Error playing stream:', err?.message || err);
        refs.current.consecutiveErrors++;
        if (refs.current.mounted) {
          setError('Unable to play stream. Please try again.');
          refs.current.isPlaying = false;
          setIsPlaying(false);
          setIsLoading(false);
        }
        await cleanupPlayer();
      } finally {
        if (refs.current.playSessionId === startSessionId) {
          refs.current.isSwitching = false;
        }
      }
    })();

    refs.current.pendingPlay = playPromise.finally(() => {
      if (refs.current.pendingPlay === playPromise) {
        refs.current.pendingPlay = null;
      }
    });

    return refs.current.pendingPlay;
  }, [configureAudioMode, volume, cleanupPlayer, playWeb, getRetryDelay]);

  const pause = useCallback(async () => {
    try {
      refs.current.playSessionId++;
      refs.current.pendingPlay = null;
      refs.current.isSwitching = false;
      refs.current.isRecovering = false;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
        setError(null);
        setIsLoading(false);
      }
      await cleanupPlayer();
    } catch (err) {
      console.error('Error pausing stream:', err);
      refs.current.player = null;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
      }
    }
  }, [cleanupPlayer]);

  const stop = useCallback(async () => {
    try {
      refs.current.playSessionId++;
      refs.current.pendingPlay = null;
      refs.current.isSwitching = false;
      refs.current.isRecovering = false;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
        setError(null);
        setIsLoading(false);
      }
      await cleanupPlayer();
    } catch (err) {
      console.error('Error stopping stream:', err);
      refs.current.player = null;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
      }
    }
  }, [cleanupPlayer]);

  const changeVolume = useCallback(async (newVolume: number) => {
    try {
      if (refs.current.mounted) {
        setVolume(newVolume);
      }
      
      if (Platform.OS === 'web' && refs.current.webAudio) {
        refs.current.webAudio.volume = newVolume;
        return;
      }
      
      if (refs.current.player) {
        refs.current.player.volume = newVolume;
        console.log('Volume changed to:', newVolume);
      }
    } catch (err) {
      console.error('Error changing volume:', err);
    }
  }, []);

  useEffect(() => {
    refs.current.playFn = play;
    refs.current.cleanupFn = cleanupPlayer;
  }, [play, cleanupPlayer]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    configureAudioMode().catch((e) => {
      console.warn('[Radio] Initial audio setup failed:', e);
    });
  }, [configureAudioMode]);
  
  useEffect(() => {
    const currentRefs = refs.current;
    currentRefs.mounted = true;
    return () => {
      currentRefs.mounted = false;
    };
  }, []);

  useEffect(() => {
    const currentRefs = refs.current;
    return () => {
      currentRefs.playSessionId++;
      currentRefs.pendingPlay = null;
      currentRefs.isRecovering = false;
      currentRefs.isSwitching = false;

      clearAllTimers();
      if (Platform.OS === 'web' && currentRefs.webAudio) {
        currentRefs.webAudio.pause();
        currentRefs.webAudio.src = '';
      } else if (currentRefs.player) {
        try {
          if (currentRefs.player.playing) {
            currentRefs.player.pause();
          }
          if (typeof currentRefs.player.release === 'function') {
            currentRefs.player.release();
          }
        } catch (err) {
          console.error('Error cleaning up player:', err);
        }
      }
    };
  }, [clearAllTimers]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const sessionAtStart = refs.current.playSessionId;
      if (!refs.current.mounted) return;

      console.log('[Radio] AppState changed to:', nextAppState, { sessionAtStart });

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        refs.current.isInBackground = true;

        if (Platform.OS === 'android' && refs.current.isPlaying) {
          try {
            await configureAudioMode();
            console.log('[Radio] Background audio mode refreshed');
          } catch (e) {
            console.warn('[Radio] Error configuring background audio:', e);
          }
        }
        return;
      }

      if (nextAppState === 'active') {
        refs.current.isInBackground = false;
        refs.current.lastBufferTime = Date.now();

        if (Platform.OS === 'android') {
          try {
            await configureAudioMode();
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (e) {
            console.warn('[Radio] Error re-configuring audio:', e);
          }
        }

        if (refs.current.playSessionId !== sessionAtStart) {
          console.log('[Radio] AppState handler aborted (session changed)', {
            sessionAtStart,
            current: refs.current.playSessionId,
          });
          return;
        }

        if (refs.current.player && refs.current.isPlaying) {
          try {
            const player = refs.current.player;

            if (player.playing) {
              console.log('[Radio] Audio still playing after return');
              refs.current.lastPlaybackTime = Date.now();
              refs.current.lastBufferTime = Date.now();
              refs.current.lastSuccessfulPlay = Date.now();
              refs.current.stallCount = 0;
              setIsPlaying(true);
              setIsLoading(false);
              setError(null);
            } else if (player.isBuffering) {
              console.log('[Radio] Audio buffering after return');
              refs.current.lastBufferTime = Date.now();
              setIsLoading(true);
            } else if (!refs.current.isRecovering) {
              console.log('[Radio] Audio stopped while in background, restarting...');

              try {
                console.log('[Radio] Attempting to resume playback...');
                player.play();
                await new Promise((resolve) =>
                  setTimeout(resolve, Platform.OS === 'android' ? 1500 : 2000)
                );

                if (player.playing) {
                  console.log('[Radio] Resume successful');
                  refs.current.lastPlaybackTime = Date.now();
                  refs.current.lastBufferTime = Date.now();
                  refs.current.stallCount = 0;
                  return;
                }
              } catch (resumeErr) {
                console.warn('[Radio] Resume attempt failed:', resumeErr);
              }

              if (refs.current.playSessionId !== sessionAtStart) return;

              refs.current.isRecovering = true;
              setIsLoading(true);
              await cleanupPlayer();
              const delay = getRetryDelay();
              await new Promise((resolve) => setTimeout(resolve, delay));
              if (refs.current.mounted && refs.current.playSessionId === sessionAtStart) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }
          } catch (err) {
            console.warn('[Radio] Error checking status on return:', err);
            if (
              refs.current.isPlaying &&
              !refs.current.isRecovering &&
              refs.current.mounted &&
              refs.current.playSessionId === sessionAtStart
            ) {
              refs.current.isRecovering = true;
              await cleanupPlayer();
              const delay = getRetryDelay();
              await new Promise((resolve) => setTimeout(resolve, delay));
              if (refs.current.mounted && refs.current.playSessionId === sessionAtStart) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }
          }
        } else if (
          refs.current.isPlaying &&
          !refs.current.player &&
          !refs.current.isRecovering &&
          refs.current.mounted
        ) {
          console.log('[Radio] No player but state was playing, reconnecting...');
          refs.current.isRecovering = true;
          const delay = getRetryDelay();
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (refs.current.mounted && refs.current.playSessionId === sessionAtStart) {
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [configureAudioMode, cleanupPlayer, getRetryDelay]);

  return useMemo(
    () => ({
      isPlaying,
      isLoading,
      volume,
      error,
      play,
      pause,
      stop,
      changeVolume,
    }),
    [isPlaying, isLoading, volume, error, play, pause, stop, changeVolume]
  );
});
