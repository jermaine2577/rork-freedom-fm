import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform, AppState, AppStateStatus } from 'react-native';

let Audio: any = null;
let InterruptionModeAndroid: any = null;
let InterruptionModeIOS: any = null;
let audioModuleLoaded = false;

const loadAudioModule = (): boolean => {
  if (Platform.OS === 'web') return false;
  if (audioModuleLoaded && Audio) return true;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoAV = require('expo-av');
    if (ExpoAV && ExpoAV.Audio && ExpoAV.Audio.Sound) {
      Audio = ExpoAV.Audio;
      InterruptionModeAndroid = ExpoAV.InterruptionModeAndroid;
      InterruptionModeIOS = ExpoAV.InterruptionModeIOS;
      audioModuleLoaded = true;
      console.log('[Radio] Audio module loaded successfully');
      return true;
    }
    console.warn('[Radio] Audio module structure invalid');
    return false;
  } catch (error) {
    console.warn('[Radio] expo-av not available:', error);
    return false;
  }
};

const STREAM_URL = 'https://castpanel.freedomfm1065.com/listen/freedom_fm_106.5/mobile.mp3';

const STREAM_TIMEOUT = 30000;
const BUFFER_TIMEOUT = 25000;
const MAX_RETRY_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 3000;
const STALE_CHECK_THRESHOLD = 10000;
const ANDROID_KEEPALIVE_INTERVAL = 10000;
const ANDROID_WATCHDOG_INTERVAL = 60000;

export const [RadioProvider, useRadio] = createContextHook(() => {
  // All useState hooks first - MUST be in fixed order
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  
  // All useRef hooks - MUST be in fixed order
  const soundRef = useRef<any>(null);
  const audioSetupRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const isSwitchingRef = useRef<boolean>(false);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const androidKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const androidWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastKnownPositionRef = useRef<number>(0);
  const watchdogPositionRef = useRef<number>(0);
  const watchdogCheckCountRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const lastPlaybackTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<number>(0);
  const positionStuckCountRef = useRef<number>(0);
  const isRecoveringRef = useRef<boolean>(false);
  const playFnRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const cleanupFnRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const mountedRef = useRef<boolean>(true);

  // All useCallback hooks - MUST be in fixed order
  const setupAudio = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('Audio not supported on web');
      return false;
    }
    
    if (audioSetupRef.current) return true;
    
    const moduleLoaded = loadAudioModule();
    if (!moduleLoaded || !Audio) {
      console.warn('Audio module not available');
      return false;
    }
    
    try {
      const audioModeConfig: any = {
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      };
      
      if (InterruptionModeIOS) {
        audioModeConfig.interruptionModeIOS = InterruptionModeIOS.DoNotMix;
      }
      if (InterruptionModeAndroid) {
        audioModeConfig.interruptionModeAndroid = InterruptionModeAndroid.DoNotMix;
      }
      
      await Audio.setAudioModeAsync(audioModeConfig);
      audioSetupRef.current = true;
      console.log('Audio setup completed successfully');
      return true;
    } catch (err) {
      console.error('Error setting up audio:', err);
      audioSetupRef.current = false;
      return false;
    }
  }, []);

  const updateNowPlaying = useCallback(async (isPlayingParam: boolean) => {
    if (Platform.OS === 'web') return;
    
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setProgressUpdateIntervalAsync(1000);
        }
      }
      console.log('Now Playing info updated, playing:', isPlayingParam);
    } catch (error) {
      console.error('Error updating Now Playing info:', error);
    }
  }, []);

  const clearBufferTimeout = useCallback(() => {
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
  }, []);

  const clearHealthCheck = useCallback(() => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
    }
  }, []);

  const clearAndroidKeepAlive = useCallback(() => {
    if (androidKeepAliveRef.current) {
      clearInterval(androidKeepAliveRef.current);
      androidKeepAliveRef.current = null;
    }
  }, []);

  const clearAndroidWatchdog = useCallback(() => {
    if (androidWatchdogRef.current) {
      clearInterval(androidWatchdogRef.current);
      androidWatchdogRef.current = null;
    }
    watchdogCheckCountRef.current = 0;
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status || !mountedRef.current) return;
    
    if (status.didJustFinish) {
      console.log('[Radio] Stream ended, attempting to reconnect...');
      if (isPlayingRef.current && !isRecoveringRef.current && mountedRef.current) {
        isRecoveringRef.current = true;
        setTimeout(() => {
          if (mountedRef.current) {
            isRecoveringRef.current = false;
            playFnRef.current?.();
          }
        }, 1000);
      }
      return;
    }
    
    if (status.isLoaded) {
      if (status.isPlaying) {
        if (!isPlayingRef.current) {
          console.log('[Radio] Audio started playing');
        }
        isPlayingRef.current = true;
        if (mountedRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
          setError(null);
        }
        clearBufferTimeout();
        retryCountRef.current = 0;
        lastPlaybackTimeRef.current = Date.now();
      } else if (status.isBuffering) {
        if (mountedRef.current) {
          setIsLoading(true);
        }
        if (!bufferTimeoutRef.current) {
          console.log('[Radio] Audio is buffering...');
          bufferTimeoutRef.current = setTimeout(async () => {
            console.log('[Radio] Buffer timeout - attempting recovery...');
            if (isPlayingRef.current && !isRecoveringRef.current && mountedRef.current) {
              console.log('[Radio] Attempting auto-recovery from buffer timeout...');
              isRecoveringRef.current = true;
              setError('Reconnecting...');
              await cleanupFnRef.current?.();
              await new Promise(resolve => setTimeout(resolve, 500));
              if (mountedRef.current) {
                isRecoveringRef.current = false;
                playFnRef.current?.();
              }
            }
          }, BUFFER_TIMEOUT);
        }
      } else {
        if (!isSwitchingRef.current && !isRecoveringRef.current && mountedRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setIsLoading(false);
        }
        clearBufferTimeout();
      }
    } else if (status.error) {
      console.error('[Radio] Playback error:', status.error);
      if (mountedRef.current) {
        setError('Playback error: ' + status.error);
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
      }
      clearBufferTimeout();
    }
  }, [clearBufferTimeout]);

  const cleanupSound = useCallback(async () => {
    clearBufferTimeout();
    clearHealthCheck();
    clearAndroidKeepAlive();
    clearAndroidWatchdog();
    positionStuckCountRef.current = 0;
    lastPositionRef.current = 0;
    lastKnownPositionRef.current = 0;
    watchdogPositionRef.current = 0;
    watchdogCheckCountRef.current = 0;
    
    if (!soundRef.current) {
      console.log('[Radio] No sound to cleanup');
      return;
    }
    
    try {
      const sound = soundRef.current;
      soundRef.current = null;
      
      console.log('[Radio] Starting sound cleanup...');
      
      try {
        if (typeof sound.getStatusAsync === 'function') {
          const status = await sound.getStatusAsync();
          if (status && status.isLoaded) {
            if (typeof sound.stopAsync === 'function') {
              await sound.stopAsync().catch((e: any) => console.warn('[Radio] stopAsync error:', e?.message));
            }
            if (typeof sound.unloadAsync === 'function') {
              await sound.unloadAsync().catch((e: any) => console.warn('[Radio] unloadAsync error:', e?.message));
            }
          }
        }
      } catch {
        try {
          if (typeof sound.unloadAsync === 'function') {
            await sound.unloadAsync();
          }
        } catch (unloadErr: any) {
          console.warn('[Radio] Final cleanup error:', unloadErr?.message);
        }
      }
      console.log('[Radio] Sound cleanup completed');
    } catch (e: any) {
      console.warn('[Radio] Error during sound cleanup:', e?.message);
      soundRef.current = null;
    }
  }, [clearBufferTimeout, clearHealthCheck, clearAndroidKeepAlive, clearAndroidWatchdog]);

  const play = useCallback(async () => {
    if (Platform.OS === 'web') {
      setError('Audio playback is not supported on web. Please use the mobile app.');
      setIsLoading(false);
      return;
    }
    
    console.log('[Radio] Play requested, platform:', Platform.OS);
    
    const moduleLoaded = loadAudioModule();
    if (!moduleLoaded || !Audio) {
      console.error('[Radio] Audio module not loaded');
      setError('Audio module not available. Please restart the app.');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const audioSetupSuccess = await setupAudio();
      if (!audioSetupSuccess) {
        console.error('[Radio] Audio setup failed');
        setError('Failed to initialize audio. Please restart the app.');
        setIsLoading(false);
        return;
      }
      
      console.log('[Radio] Play requested...');
      console.log('[Radio] Stream URL:', STREAM_URL);
      
      await cleanupSound();
      
      // Small delay for Android to ensure cleanup is complete
      if (Platform.OS === 'android') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('[Radio] Creating new audio stream...');
      
      let newSound: any = null;
      
      try {
        if (!Audio || !Audio.Sound) {
          throw new Error('Audio.Sound not properly initialized');
        }
        
        if (typeof Audio.Sound.createAsync !== 'function') {
          console.error('[Radio] createAsync is not a function, Audio.Sound:', Audio.Sound);
          throw new Error('Audio.Sound.createAsync not available');
        }
        
        console.log('[Radio] Calling Audio.Sound.createAsync');
        
        const initialStatus: any = { 
            shouldPlay: true,
            volume: volume,
            isLooping: false,
            progressUpdateIntervalMillis: 1000,
            rate: 1.0,
            shouldCorrectPitch: false,
          };
          
          const streamUri = `${STREAM_URL}?t=${Date.now()}`;
          
          const createSoundPromise = Audio.Sound.createAsync(
            { 
              uri: streamUri,
              overrideFileExtensionAndroid: 'mp3',
            },
            initialStatus,
            onPlaybackStatusUpdate
          );
        
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Stream connection timed out'));
          }, STREAM_TIMEOUT);
        });
        
        const result = await Promise.race([createSoundPromise, timeoutPromise]);
        
        console.log('[Radio] createAsync completed, result:', !!result, 'sound:', !!(result as any)?.sound);
        
        if (!result || !(result as any).sound) {
          throw new Error('Failed to create sound object');
        }
        
        newSound = (result as any).sound;
      } catch (createError: any) {
        console.error('[Radio] Error creating audio:', createError?.message || createError);
        const errorMsg = createError?.message?.includes('timed out')
          ? 'Stream connection timed out. Please try again.'
          : 'Unable to load stream. Please check your connection.';
        setError(errorMsg);
        setIsLoading(false);
        return;
      }
      
      soundRef.current = newSound;
      console.log('[Radio] New sound created successfully');
      
      console.log('[Radio] Stream created with shouldPlay: true, waiting for playback confirmation...');
      
      let playbackConfirmed = false;
      const maxWaitTime = 10000;
      const checkInterval = 500;
      let waitedTime = 0;
      
      while (!playbackConfirmed && waitedTime < maxWaitTime) {
        try {
          if (newSound && typeof newSound.getStatusAsync === 'function') {
            const status = await newSound.getStatusAsync();
            if (status?.isLoaded && status?.isPlaying) {
              playbackConfirmed = true;
              console.log('[Radio] Playback confirmed playing');
              break;
            } else if (status?.isLoaded && !status?.isPlaying && !status?.isBuffering) {
              console.log('[Radio] Sound loaded but not playing, calling playAsync');
              await newSound.playAsync();
            }
          }
        } catch (checkErr) {
          console.warn('[Radio] Status check error:', checkErr);
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitedTime += checkInterval;
      }
      
      if (!playbackConfirmed) {
        console.warn('[Radio] Could not confirm playback within timeout, continuing anyway');
      }
      
      try {
        await updateNowPlaying(true);
      } catch (nowPlayingError) {
        console.warn('[Radio] Error updating now playing:', nowPlayingError);
      }
      
      try {
        if (newSound && typeof newSound.getStatusAsync === 'function') {
          const status = await newSound.getStatusAsync();
          console.log('[Radio] Sound status after creation:', {
            isLoaded: status?.isLoaded,
            isPlaying: status?.isLoaded && status?.isPlaying,
            volume: status?.isLoaded && status?.volume,
          });
        }
      } catch (statusError) {
        console.warn('[Radio] Error getting status:', statusError);
      }
      
      clearHealthCheck();
      healthCheckRef.current = setInterval(async () => {
        if (!soundRef.current || !isPlayingRef.current || !mountedRef.current) {
          clearHealthCheck();
          return;
        }
        
        try {
          const status = await soundRef.current.getStatusAsync();
          const timeSinceLastPlayback = Date.now() - lastPlaybackTimeRef.current;
          const currentPosition = status?.positionMillis || 0;
          
          if (status?.isLoaded && status?.isPlaying) {
            if (currentPosition === lastPositionRef.current && currentPosition > 0) {
              positionStuckCountRef.current++;
              console.log('[Radio] Position stuck count:', positionStuckCountRef.current, 'at position:', currentPosition);
              
              if (positionStuckCountRef.current >= 3) {
                console.log('[Radio] Stream position stuck, forcing recovery...');
                positionStuckCountRef.current = 0;
                if (retryCountRef.current < MAX_RETRY_ATTEMPTS && mountedRef.current) {
                  retryCountRef.current++;
                  isRecoveringRef.current = true;
                  setError('Stream stalled. Reconnecting...');
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (mountedRef.current) {
                    isRecoveringRef.current = false;
                    playFnRef.current?.();
                  }
                }
                return;
              }
            } else {
              positionStuckCountRef.current = 0;
              lastPositionRef.current = currentPosition;
            }
            
            lastPlaybackTimeRef.current = Date.now();
            retryCountRef.current = 0;
            if (isRecoveringRef.current) {
              isRecoveringRef.current = false;
              setError(null);
            }
          } else if (status?.isLoaded && !status?.isPlaying && !status?.isBuffering && isPlayingRef.current && timeSinceLastPlayback > STALE_CHECK_THRESHOLD) {
            console.log('[Radio] Stream appears stuck, attempting recovery...');
            if (retryCountRef.current < MAX_RETRY_ATTEMPTS && mountedRef.current) {
              retryCountRef.current++;
              isRecoveringRef.current = true;
              setError('Stream interrupted. Reconnecting...');
              await cleanupSound();
              await new Promise(resolve => setTimeout(resolve, 1000));
              if (mountedRef.current) {
                isRecoveringRef.current = false;
                playFnRef.current?.();
              }
            } else if (mountedRef.current) {
              console.log('[Radio] Max retry attempts reached');
              setError('Stream unavailable. Please try again later.');
              isPlayingRef.current = false;
              setIsPlaying(false);
              setIsLoading(false);
              retryCountRef.current = 0;
            }
          }
        } catch (healthErr) {
          console.warn('[Radio] Health check error:', healthErr);
        }
      }, HEALTH_CHECK_INTERVAL);
      
      if (Platform.OS === 'android') {
        clearAndroidKeepAlive();
        clearAndroidWatchdog();
        
        androidKeepAliveRef.current = setInterval(async () => {
          if (!soundRef.current || !isPlayingRef.current || !mountedRef.current) {
            clearAndroidKeepAlive();
            return;
          }
          
          try {
            const status = await soundRef.current.getStatusAsync();
            const currentPosition = status?.positionMillis || 0;
            
            console.log('[Radio] Android keep-alive check:', {
              isPlaying: status?.isPlaying,
              isBuffering: status?.isBuffering,
              position: currentPosition,
              lastPosition: lastKnownPositionRef.current,
            });
            
            if (status?.isLoaded) {
              if (status?.isPlaying) {
                if (currentPosition > lastKnownPositionRef.current) {
                  lastKnownPositionRef.current = currentPosition;
                } else if (currentPosition === lastKnownPositionRef.current && currentPosition > 0) {
                  console.log('[Radio] Android keep-alive: position not advancing, forcing refresh...');
                  try {
                    await soundRef.current.setStatusAsync({ positionMillis: 0, shouldPlay: true });
                  } catch (refreshErr) {
                    console.warn('[Radio] Refresh error:', refreshErr);
                  }
                }
              } else if (!status?.isPlaying && !status?.isBuffering && isPlayingRef.current && !isRecoveringRef.current) {
                console.log('[Radio] Android keep-alive: stream stopped unexpectedly, restarting...');
                
                try {
                  await soundRef.current.playAsync();
                  console.log('[Radio] Android keep-alive: playAsync called');
                  
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  const newStatus = await soundRef.current.getStatusAsync();
                  
                  if (!newStatus?.isPlaying && mountedRef.current) {
                    console.log('[Radio] Android keep-alive: playAsync failed, full restart needed');
                    isRecoveringRef.current = true;
                    await cleanupSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (mountedRef.current) {
                      isRecoveringRef.current = false;
                      playFnRef.current?.();
                    }
                  }
                } catch (playErr) {
                  console.warn('[Radio] Android keep-alive play error:', playErr);
                  isRecoveringRef.current = true;
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (mountedRef.current) {
                    isRecoveringRef.current = false;
                    playFnRef.current?.();
                  }
                }
              }
            } else {
              console.log('[Radio] Android keep-alive: sound not loaded, reconnecting...');
              if (!isRecoveringRef.current && mountedRef.current) {
                isRecoveringRef.current = true;
                await cleanupSound();
                await new Promise(resolve => setTimeout(resolve, 500));
                if (mountedRef.current) {
                  isRecoveringRef.current = false;
                  playFnRef.current?.();
                }
              }
            }
          } catch (keepAliveErr) {
            console.warn('[Radio] Android keep-alive error:', keepAliveErr);
            if (!isRecoveringRef.current && isPlayingRef.current && mountedRef.current) {
              console.log('[Radio] Keep-alive error triggered recovery');
              isRecoveringRef.current = true;
              await cleanupSound();
              await new Promise(resolve => setTimeout(resolve, 500));
              if (mountedRef.current) {
                isRecoveringRef.current = false;
                playFnRef.current?.();
              }
            }
          }
        }, ANDROID_KEEPALIVE_INTERVAL);
        
        androidWatchdogRef.current = setInterval(async () => {
          if (!soundRef.current || !isPlayingRef.current || !mountedRef.current) {
            clearAndroidWatchdog();
            return;
          }
          
          try {
            const status = await soundRef.current.getStatusAsync();
            const currentPosition = status?.positionMillis || 0;
            
            console.log('[Radio] Android watchdog check:', {
              currentPosition,
              watchdogPosition: watchdogPositionRef.current,
              checkCount: watchdogCheckCountRef.current,
            });
            
            if (currentPosition === watchdogPositionRef.current && watchdogPositionRef.current > 0) {
              watchdogCheckCountRef.current++;
              
              if (watchdogCheckCountRef.current >= 2) {
                console.log('[Radio] Android watchdog: stream appears dead, forcing full reconnect...');
                watchdogCheckCountRef.current = 0;
                
                if (!isRecoveringRef.current && mountedRef.current) {
                  isRecoveringRef.current = true;
                  setError('Stream reconnecting...');
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  if (mountedRef.current) {
                    isRecoveringRef.current = false;
                    playFnRef.current?.();
                  }
                }
              }
            } else {
              watchdogCheckCountRef.current = 0;
              watchdogPositionRef.current = currentPosition;
            }
          } catch (watchdogErr) {
            console.warn('[Radio] Android watchdog error:', watchdogErr);
          }
        }, ANDROID_WATCHDOG_INTERVAL);
      }
      
      retryCountRef.current = 0;
      isRecoveringRef.current = false;
      
    } catch (err: any) {
      console.error('[Radio] Error playing stream:', err?.message || err);
      console.error('[Radio] Error details:', {
        message: err?.message,
        code: err?.code,
        name: err?.name,
      });
      if (mountedRef.current) {
        setError('Unable to play stream. Please try again.');
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
      }
      await cleanupSound();
    }
  }, [setupAudio, onPlaybackStatusUpdate, volume, updateNowPlaying, cleanupSound, clearHealthCheck, clearAndroidKeepAlive, clearAndroidWatchdog]);

  // All useEffect hooks - MUST be in fixed order
  useEffect(() => {
    mountedRef.current = true;
    playFnRef.current = play;
    cleanupFnRef.current = cleanupSound;
    
    return () => {
      mountedRef.current = false;
    };
  }, [play, cleanupSound]);

  const pause = useCallback(async () => {
    try {
      isPlayingRef.current = false;
      if (mountedRef.current) {
        setIsPlaying(false);
        setError(null);
      }
      await cleanupSound();
    } catch (err) {
      console.error('Error pausing stream:', err);
      soundRef.current = null;
      isPlayingRef.current = false;
      if (mountedRef.current) {
        setIsPlaying(false);
      }
    }
  }, [cleanupSound]);

  const stop = useCallback(async () => {
    try {
      isPlayingRef.current = false;
      if (mountedRef.current) {
        setIsPlaying(false);
        setError(null);
      }
      await cleanupSound();
    } catch (err) {
      console.error('Error stopping stream:', err);
      soundRef.current = null;
      isPlayingRef.current = false;
      if (mountedRef.current) {
        setIsPlaying(false);
      }
    }
  }, [cleanupSound]);

  const changeVolume = useCallback(async (newVolume: number) => {
    try {
      if (mountedRef.current) {
        setVolume(newVolume);
      }
      if (soundRef.current && typeof soundRef.current.getStatusAsync === 'function') {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status && status.isLoaded && typeof soundRef.current.setVolumeAsync === 'function') {
            await soundRef.current.setVolumeAsync(newVolume);
            console.log('Volume changed to:', newVolume);
          }
        } catch (volumeError) {
          console.warn('Could not set volume:', volumeError);
        }
      }
    } catch (err) {
      console.error('Error changing volume:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearBufferTimeout();
      clearHealthCheck();
      clearAndroidKeepAlive();
      clearAndroidWatchdog();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err: any) => console.error('Error unloading sound:', err));
      }
    };
  }, [clearBufferTimeout, clearHealthCheck, clearAndroidKeepAlive, clearAndroidWatchdog]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (!mountedRef.current) return;
      
      console.log('[Radio] AppState changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        if (Platform.OS === 'android') {
          try {
            await setupAudio();
          } catch (setupErr) {
            console.warn('[Radio] Error re-setting up audio on Android:', setupErr);
          }
        }
        
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            console.log('[Radio] Syncing state after app return:', {
              isLoaded: status?.isLoaded,
              isPlaying: status?.isPlaying,
              currentIsPlaying: isPlayingRef.current,
            });
            
            if (!mountedRef.current) return;
            
            if (status && status.isLoaded) {
              if (status.isPlaying) {
                if (!isPlayingRef.current) {
                  console.log('[Radio] Audio playing but state was wrong, fixing...');
                  isPlayingRef.current = true;
                  setIsPlaying(true);
                }
                setIsLoading(false);
                setError(null);
              } else if (isPlayingRef.current && !isRecoveringRef.current) {
                console.log('[Radio] Audio stopped while in background, attempting restart...');
                setIsLoading(true);
                
                try {
                  await soundRef.current.playAsync();
                  console.log('[Radio] Restart playAsync called');
                  
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  const newStatus = await soundRef.current.getStatusAsync();
                  
                  if (newStatus?.isPlaying) {
                    console.log('[Radio] Restart successful');
                    setIsLoading(false);
                    setError(null);
                  } else {
                    console.log('[Radio] Restart failed, full reconnect needed');
                    isRecoveringRef.current = true;
                    await cleanupSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (mountedRef.current) {
                      isRecoveringRef.current = false;
                      playFnRef.current?.();
                    }
                  }
                } catch (restartErr) {
                  console.warn('[Radio] Restart error, full reconnect:', restartErr);
                  isRecoveringRef.current = true;
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (mountedRef.current) {
                    isRecoveringRef.current = false;
                    playFnRef.current?.();
                  }
                }
              } else {
                console.log('[Radio] Audio stopped while in background');
                isPlayingRef.current = false;
                setIsPlaying(false);
                setIsLoading(false);
              }
            } else {
              console.log('[Radio] Sound was unloaded while in background');
              if (isPlayingRef.current && !isRecoveringRef.current && mountedRef.current) {
                console.log('[Radio] Was playing, attempting full reconnect...');
                soundRef.current = null;
                isRecoveringRef.current = true;
                await new Promise(resolve => setTimeout(resolve, 500));
                if (mountedRef.current) {
                  isRecoveringRef.current = false;
                  playFnRef.current?.();
                }
              } else {
                soundRef.current = null;
                isPlayingRef.current = false;
                setIsPlaying(false);
                setIsLoading(false);
              }
            }
          } catch (err) {
            console.warn('[Radio] Error checking status on app return:', err);
            if (isPlayingRef.current && !isRecoveringRef.current && mountedRef.current) {
              console.log('[Radio] Error but was playing, attempting reconnect...');
              soundRef.current = null;
              isRecoveringRef.current = true;
              await new Promise(resolve => setTimeout(resolve, 500));
              if (mountedRef.current) {
                isRecoveringRef.current = false;
                playFnRef.current?.();
              }
            } else if (mountedRef.current) {
              soundRef.current = null;
              isPlayingRef.current = false;
              setIsPlaying(false);
              setIsLoading(false);
            }
          }
        } else if (isPlayingRef.current && !isRecoveringRef.current && mountedRef.current) {
          console.log('[Radio] No sound but state was playing, attempting reconnect...');
          isRecoveringRef.current = true;
          await new Promise(resolve => setTimeout(resolve, 500));
          if (mountedRef.current) {
            isRecoveringRef.current = false;
            playFnRef.current?.();
          }
        } else if (mountedRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setIsLoading(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [setupAudio, cleanupSound]);

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
