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
const BUFFER_TIMEOUT = 45000;
const BACKGROUND_BUFFER_TIMEOUT = 120000;
const MAX_RETRY_ATTEMPTS = 15;
const HEALTH_CHECK_INTERVAL = 10000;
const STALE_CHECK_THRESHOLD = 60000;
const ANDROID_KEEPALIVE_INTERVAL = 10000;
const ANDROID_BACKGROUND_CHECK_INTERVAL = 20000;

interface RadioRefs {
  mounted: boolean;
  sound: any;
  webAudio: HTMLAudioElement | null;
  audioSetup: boolean;
  isPlaying: boolean;
  isSwitching: boolean;
  bufferTimeout: ReturnType<typeof setTimeout> | null;
  healthCheck: ReturnType<typeof setInterval> | null;
  androidKeepAlive: ReturnType<typeof setInterval> | null;
  androidWatchdog: ReturnType<typeof setInterval> | null;
  androidBackgroundCheck: ReturnType<typeof setInterval> | null;
  lastKnownPosition: number;
  watchdogPosition: number;
  watchdogCheckCount: number;
  retryCount: number;
  lastPlaybackTime: number;
  lastPosition: number;
  positionStuckCount: number;
  isRecovering: boolean;
  playFn: (() => Promise<void>) | undefined;
  cleanupFn: (() => Promise<void>) | undefined;
  lastDataReceived: number;
  isInBackground: boolean;
  backgroundBufferRetries: number;
}

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  
  const refs = useRef<RadioRefs>({
    mounted: true,
    sound: null,
    webAudio: null,
    audioSetup: false,
    isPlaying: false,
    isSwitching: false,
    bufferTimeout: null,
    healthCheck: null,
    androidKeepAlive: null,
    androidWatchdog: null,
    androidBackgroundCheck: null,
    lastKnownPosition: 0,
    watchdogPosition: 0,
    watchdogCheckCount: 0,
    retryCount: 0,
    lastPlaybackTime: 0,
    lastPosition: 0,
    positionStuckCount: 0,
    isRecovering: false,
    playFn: undefined,
    cleanupFn: undefined,
    lastDataReceived: Date.now(),
    isInBackground: false,
    backgroundBufferRetries: 0,
  });

  const configureAudioMode = useCallback(async (): Promise<boolean> => {
    const moduleLoaded = loadAudioModule();
    if (!moduleLoaded || !Audio) return false;
    
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
      return true;
    } catch (err) {
      console.warn('[Radio] Error configuring audio mode:', err);
      return false;
    }
  }, []);

  const setupAudio = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[Radio] Web audio setup - using HTML5 Audio');
      refs.current.audioSetup = true;
      return true;
    }
    
    if (refs.current.audioSetup) return true;
    
    const success = await configureAudioMode();
    if (success) {
      refs.current.audioSetup = true;
      console.log('Audio setup completed successfully');
    } else {
      console.error('Audio setup failed');
      refs.current.audioSetup = false;
    }
    return success;
  }, [configureAudioMode]);

  const updateNowPlaying = useCallback(async (isPlayingParam: boolean) => {
    if (Platform.OS === 'web') return;
    
    try {
      if (refs.current.sound) {
        const status = await refs.current.sound.getStatusAsync();
        if (status.isLoaded) {
          await refs.current.sound.setProgressUpdateIntervalAsync(1000);
        }
      }
      console.log('Now Playing info updated, playing:', isPlayingParam);
    } catch (error) {
      console.error('Error updating Now Playing info:', error);
    }
  }, [refs]);

  const clearAllTimers = useCallback(() => {
    if (refs.current.bufferTimeout) {
      clearTimeout(refs.current.bufferTimeout);
      refs.current.bufferTimeout = null;
    }
    if (refs.current.healthCheck) {
      clearInterval(refs.current.healthCheck);
      refs.current.healthCheck = null;
    }
    if (refs.current.androidKeepAlive) {
      clearInterval(refs.current.androidKeepAlive);
      refs.current.androidKeepAlive = null;
    }
    if (refs.current.androidWatchdog) {
      clearInterval(refs.current.androidWatchdog);
      refs.current.androidWatchdog = null;
    }
    refs.current.watchdogCheckCount = 0;
    if (refs.current.androidBackgroundCheck) {
      clearInterval(refs.current.androidBackgroundCheck);
      refs.current.androidBackgroundCheck = null;
    }
  }, [refs]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status || !refs.current.mounted) return;
    
    if (status.didJustFinish) {
      console.log('[Radio] Stream ended, attempting to reconnect...');
      if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
        refs.current.isRecovering = true;
        setTimeout(() => {
          if (refs.current.mounted) {
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }
        }, 1000);
      }
      return;
    }
    
    if (status.isLoaded) {
      if (status.isPlaying) {
        if (!refs.current.isPlaying) {
          console.log('[Radio] Audio started playing');
        }
        refs.current.isPlaying = true;
        refs.current.lastDataReceived = Date.now();
        if (refs.current.mounted) {
          setIsPlaying(true);
          setIsLoading(false);
          setError(null);
        }
        if (refs.current.bufferTimeout) {
          clearTimeout(refs.current.bufferTimeout);
          refs.current.bufferTimeout = null;
        }
        refs.current.retryCount = 0;
        refs.current.lastPlaybackTime = Date.now();
      } else if (status.isBuffering) {
        if (refs.current.mounted) {
          setIsLoading(true);
        }
        
        const isBackground = refs.current.isInBackground;
        const timeout = isBackground ? BACKGROUND_BUFFER_TIMEOUT : BUFFER_TIMEOUT;
        
        if (!refs.current.bufferTimeout) {
          console.log('[Radio] Audio is buffering...', isBackground ? '(background)' : '(foreground)');
          refs.current.bufferTimeout = setTimeout(async () => {
            console.log('[Radio] Buffer timeout - attempting recovery... (background:', isBackground, ')');
            if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
              console.log('[Radio] Attempting auto-recovery from buffer timeout...');
              refs.current.isRecovering = true;
              
              if (isBackground) {
                refs.current.backgroundBufferRetries++;
                console.log('[Radio] Background buffer retry:', refs.current.backgroundBufferRetries);
              }
              
              setError('Reconnecting...');
              await refs.current.cleanupFn?.();
              await new Promise(resolve => setTimeout(resolve, isBackground ? 200 : 500));
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }
          }, timeout);
        }
      } else {
        if (!refs.current.isSwitching && !refs.current.isRecovering && refs.current.mounted) {
          refs.current.isPlaying = false;
          setIsPlaying(false);
          setIsLoading(false);
        }
        if (refs.current.bufferTimeout) {
          clearTimeout(refs.current.bufferTimeout);
          refs.current.bufferTimeout = null;
        }
      }
    } else if (status.error) {
      console.error('[Radio] Playback error:', status.error);
      if (refs.current.mounted) {
        setError('Playback error: ' + status.error);
        refs.current.isPlaying = false;
        setIsPlaying(false);
        setIsLoading(false);
      }
      if (refs.current.bufferTimeout) {
        clearTimeout(refs.current.bufferTimeout);
        refs.current.bufferTimeout = null;
      }
    }
  }, [refs]);

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
      console.log('[Radio] Web audio cleanup completed');
    }
  }, [refs]);

  const cleanupSound = useCallback(async () => {
    clearAllTimers();
    refs.current.positionStuckCount = 0;
    refs.current.lastPosition = 0;
    refs.current.lastKnownPosition = 0;
    refs.current.watchdogPosition = 0;
    refs.current.watchdogCheckCount = 0;
    
    if (Platform.OS === 'web') {
      cleanupWebAudio();
      return;
    }
    
    if (!refs.current.sound) {
      console.log('[Radio] No sound to cleanup');
      return;
    }
    
    try {
      const sound = refs.current.sound;
      refs.current.sound = null;
      
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
      refs.current.sound = null;
    }
  }, [clearAllTimers, cleanupWebAudio, refs]);

  const playWeb = useCallback(async () => {
    console.log('[Radio] Web play requested');
    
    try {
      setIsLoading(true);
      setError(null);
      
      cleanupWebAudio();
      
      const streamUri = `${STREAM_URL}?t=${Date.now()}`;
      console.log('[Radio] Creating web audio element for:', streamUri);
      
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
          console.log('[Radio] Web audio playing');
          clearTimeout(timeout);
          refs.current.isPlaying = true;
          refs.current.lastDataReceived = Date.now();
          if (refs.current.mounted) {
            setIsPlaying(true);
            setIsLoading(false);
            setError(null);
          }
          resolve();
        };
        
        audio.onwaiting = () => {
          console.log('[Radio] Web audio buffering...');
          if (refs.current.mounted) {
            setIsLoading(true);
          }
        };
        
        audio.onerror = (event: Event | string) => {
          console.error('[Radio] Web audio error:', event);
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
          console.log('[Radio] Web audio stream ended');
          if (refs.current.isPlaying && refs.current.mounted && !refs.current.isRecovering) {
            console.log('[Radio] Attempting to reconnect...');
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
          console.log('[Radio] Web audio paused');
          if (!refs.current.isSwitching && !refs.current.isRecovering && refs.current.mounted) {
            refs.current.isPlaying = false;
            setIsPlaying(false);
          }
        };
      });
      
      audio.src = streamUri;
      audio.volume = volume;
      refs.current.webAudio = audio;
      
      console.log('[Radio] Starting web audio playback...');
      await audio.play();
      await playPromise;
      
      console.log('[Radio] Web audio started successfully');
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
  }, [volume, cleanupWebAudio, refs]);

  const play = useCallback(async () => {
    if (Platform.OS === 'web') {
      return playWeb();
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
          
          const sourceConfig: any = { 
            uri: streamUri,
            overrideFileExtensionAndroid: 'mp3',
          };
          
          // Use SimpleExoPlayer on Android for better live streaming support
          if (Platform.OS === 'android') {
            sourceConfig.androidImplementation = 'SimpleExoPlayer';
          }
          
          const createSoundPromise = Audio.Sound.createAsync(
            sourceConfig,
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
      
      refs.current.sound = newSound;
      refs.current.lastDataReceived = Date.now();
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
      
      if (refs.current.healthCheck) {
        clearInterval(refs.current.healthCheck);
        refs.current.healthCheck = null;
      }
      refs.current.healthCheck = setInterval(async () => {
        if (!refs.current.sound || !refs.current.isPlaying || !refs.current.mounted) {
          if (refs.current.healthCheck) {
            clearInterval(refs.current.healthCheck);
            refs.current.healthCheck = null;
          }
          return;
        }
        
        try {
          const status = await refs.current.sound.getStatusAsync();
          const timeSinceLastPlayback = Date.now() - refs.current.lastPlaybackTime;
          const currentPosition = status?.positionMillis || 0;
          
          if (status?.isLoaded && status?.isPlaying) {
            // For live streams, position might stay low while buffering - this is normal
            // Only consider stuck if NOT buffering and position hasn't moved
            if (!status?.isBuffering && currentPosition === refs.current.lastPosition && currentPosition > 0) {
              refs.current.positionStuckCount++;
              console.log('[Radio] Position stuck count:', refs.current.positionStuckCount, 'at position:', currentPosition);
              
              // Increase threshold for live streams - require 5 consecutive stuck checks
              if (refs.current.positionStuckCount >= 5) {
                console.log('[Radio] Stream position stuck, forcing recovery...');
                refs.current.positionStuckCount = 0;
                if (refs.current.retryCount < MAX_RETRY_ATTEMPTS && refs.current.mounted) {
                  refs.current.retryCount++;
                  refs.current.isRecovering = true;
                  setError('Stream stalled. Reconnecting...');
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (refs.current.mounted) {
                    refs.current.isRecovering = false;
                    refs.current.playFn?.();
                  }
                }
                return;
              }
            } else {
              // Reset stuck count - either position changed, buffering, or position is 0
              if (currentPosition !== refs.current.lastPosition || status?.isBuffering) {
                refs.current.positionStuckCount = 0;
              }
              refs.current.lastPosition = currentPosition;
              refs.current.lastDataReceived = Date.now();
            }
            
            refs.current.lastPlaybackTime = Date.now();
            refs.current.retryCount = 0;
            if (refs.current.isRecovering) {
              refs.current.isRecovering = false;
              setError(null);
            }
          } else if (status?.isLoaded && status?.isBuffering) {
            // Buffering is normal for live streams, especially on Android with MediaPlayer
            // Don't trigger stuck detection during buffering
            refs.current.lastDataReceived = Date.now();
            refs.current.positionStuckCount = 0;
            refs.current.lastPlaybackTime = Date.now();
          } else if (status?.isLoaded && !status?.isPlaying && !status?.isBuffering && refs.current.isPlaying && timeSinceLastPlayback > STALE_CHECK_THRESHOLD) {
            console.log('[Radio] Stream appears stuck, attempting recovery...');
            if (refs.current.retryCount < MAX_RETRY_ATTEMPTS && refs.current.mounted) {
              refs.current.retryCount++;
              refs.current.isRecovering = true;
              setError('Stream interrupted. Reconnecting...');
              await cleanupSound();
              await new Promise(resolve => setTimeout(resolve, 1000));
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            } else if (refs.current.mounted) {
              console.log('[Radio] Max retry attempts reached');
              setError('Stream unavailable. Please try again later.');
              refs.current.isPlaying = false;
              setIsPlaying(false);
              setIsLoading(false);
              refs.current.retryCount = 0;
            }
          }
        } catch (healthErr) {
          console.warn('[Radio] Health check error:', healthErr);
        }
      }, HEALTH_CHECK_INTERVAL);
      
      if (Platform.OS === 'android') {
        if (refs.current.androidKeepAlive) {
          clearInterval(refs.current.androidKeepAlive);
          refs.current.androidKeepAlive = null;
        }
        if (refs.current.androidWatchdog) {
          clearInterval(refs.current.androidWatchdog);
          refs.current.androidWatchdog = null;
        }
        if (refs.current.androidBackgroundCheck) {
          clearInterval(refs.current.androidBackgroundCheck);
          refs.current.androidBackgroundCheck = null;
        }
        
        refs.current.lastDataReceived = Date.now();
        
        // Unified Android keep-alive - handles both foreground and background
        refs.current.androidKeepAlive = setInterval(async () => {
          if (!refs.current.sound || !refs.current.isPlaying || !refs.current.mounted) {
            return;
          }
          
          try {
            const status = await refs.current.sound.getStatusAsync();
            const isBackground = refs.current.isInBackground;
            
            console.log('[Radio] Android keep-alive:', {
              isPlaying: status?.isPlaying,
              isBuffering: status?.isBuffering,
              position: status?.positionMillis || 0,
              background: isBackground,
            });
            
            if (status?.isLoaded) {
              if (status?.isPlaying || status?.isBuffering) {
                // Stream is active - update last data time
                refs.current.lastDataReceived = Date.now();
                refs.current.positionStuckCount = 0;
              } else if (refs.current.isPlaying && !refs.current.isRecovering) {
                // Stream stopped but should be playing - try to restart
                console.log('[Radio] Android: Stream stopped, attempting restart...');
                
                try {
                  await configureAudioMode();
                  await refs.current.sound.playAsync();
                  
                  // Wait and check if it worked
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  const newStatus = await refs.current.sound.getStatusAsync();
                  
                  if (newStatus?.isPlaying || newStatus?.isBuffering) {
                    console.log('[Radio] Android: Restart successful');
                    refs.current.lastDataReceived = Date.now();
                  } else if (refs.current.mounted && !refs.current.isRecovering) {
                    console.log('[Radio] Android: Restart failed, full reconnect...');
                    refs.current.isRecovering = true;
                    await cleanupSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (refs.current.mounted) {
                      refs.current.isRecovering = false;
                      refs.current.playFn?.();
                    }
                  }
                } catch (playErr) {
                  console.warn('[Radio] Android restart error:', playErr);
                  if (refs.current.mounted && !refs.current.isRecovering) {
                    refs.current.isRecovering = true;
                    await cleanupSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (refs.current.mounted) {
                      refs.current.isRecovering = false;
                      refs.current.playFn?.();
                    }
                  }
                }
              }
            } else if (refs.current.isPlaying && !refs.current.isRecovering) {
              // Sound unloaded - full reconnect
              console.log('[Radio] Android: Sound unloaded, reconnecting...');
              refs.current.isRecovering = true;
              await cleanupSound();
              await new Promise(resolve => setTimeout(resolve, 500));
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }
          } catch (keepAliveErr) {
            console.warn('[Radio] Android keep-alive error:', keepAliveErr);
            // On error, try full reconnect if we should be playing
            if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
              refs.current.isRecovering = true;
              await cleanupSound();
              await new Promise(resolve => setTimeout(resolve, 500));
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            }
          }
        }, ANDROID_KEEPALIVE_INTERVAL);
        
        // Periodic audio mode refresh for Android background
        refs.current.androidBackgroundCheck = setInterval(async () => {
          if (!refs.current.sound || !refs.current.isPlaying || !refs.current.mounted) {
            return;
          }
          
          try {
            // Re-apply audio mode periodically to maintain background playback
            await configureAudioMode();
            console.log('[Radio] Android: Audio mode refreshed');
          } catch (refreshErr) {
            console.warn('[Radio] Android audio mode refresh error:', refreshErr);
          }
        }, ANDROID_BACKGROUND_CHECK_INTERVAL);
      }
      
      refs.current.retryCount = 0;
      refs.current.isRecovering = false;
      
    } catch (err: any) {
      console.error('[Radio] Error playing stream:', err?.message || err);
      console.error('[Radio] Error details:', {
        message: err?.message,
        code: err?.code,
        name: err?.name,
      });
      if (refs.current.mounted) {
        setError('Unable to play stream. Please try again.');
        refs.current.isPlaying = false;
        setIsPlaying(false);
        setIsLoading(false);
      }
      await cleanupSound();
    }
  }, [setupAudio, configureAudioMode, onPlaybackStatusUpdate, volume, updateNowPlaying, cleanupSound, playWeb, refs]);

  const pause = useCallback(async () => {
    try {
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
        setError(null);
      }
      await cleanupSound();
    } catch (err) {
      console.error('Error pausing stream:', err);
      refs.current.sound = null;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
      }
    }
  }, [cleanupSound, refs]);

  const stop = useCallback(async () => {
    try {
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
        setError(null);
      }
      await cleanupSound();
    } catch (err) {
      console.error('Error stopping stream:', err);
      refs.current.sound = null;
      refs.current.isPlaying = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
      }
    }
  }, [cleanupSound, refs]);

  const changeVolume = useCallback(async (newVolume: number) => {
    try {
      if (refs.current.mounted) {
        setVolume(newVolume);
      }
      
      if (Platform.OS === 'web' && refs.current.webAudio) {
        refs.current.webAudio.volume = newVolume;
        console.log('[Radio] Web volume changed to:', newVolume);
        return;
      }
      
      if (refs.current.sound && typeof refs.current.sound.getStatusAsync === 'function') {
        try {
          const status = await refs.current.sound.getStatusAsync();
          if (status && status.isLoaded && typeof refs.current.sound.setVolumeAsync === 'function') {
            await refs.current.sound.setVolumeAsync(newVolume);
            console.log('Volume changed to:', newVolume);
          }
        } catch (volumeError) {
          console.warn('Could not set volume:', volumeError);
        }
      }
    } catch (err) {
      console.error('Error changing volume:', err);
    }
  }, [refs]);

  useEffect(() => {
    refs.current.playFn = play;
    refs.current.cleanupFn = cleanupSound;
  }, [play, cleanupSound]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setupAudio().catch((e) => {
      console.warn('[Radio] Initial audio setup failed:', e);
    });
  }, [setupAudio]);
  
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
      clearAllTimers();
      if (Platform.OS === 'web' && currentRefs.webAudio) {
        currentRefs.webAudio.pause();
        currentRefs.webAudio.src = '';
      } else if (currentRefs.sound) {
        currentRefs.sound.unloadAsync().catch((err: any) => console.error('Error unloading sound:', err));
      }
    };
  }, [clearAllTimers]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (!refs.current.mounted) return;
      
      console.log('[Radio] AppState changed to:', nextAppState);
      
      if (Platform.OS === 'android' && (nextAppState === 'background' || nextAppState === 'inactive')) {
        console.log('[Radio] Android entering background, ensuring audio continues...');
        refs.current.isInBackground = true;
        refs.current.backgroundBufferRetries = 0;
        refs.current.lastDataReceived = Date.now();
        
        if (refs.current.bufferTimeout) {
          clearTimeout(refs.current.bufferTimeout);
          refs.current.bufferTimeout = null;
        }
        
        try {
          await configureAudioMode();
          console.log('[Radio] Android background audio mode configured');
          
          if (refs.current.sound && refs.current.isPlaying) {
            const status = await refs.current.sound.getStatusAsync();
            console.log('[Radio] Android background status:', {
              isLoaded: status?.isLoaded,
              isPlaying: status?.isPlaying,
              isBuffering: status?.isBuffering,
            });
            
            if (status?.isLoaded) {
              if (status?.isPlaying || status?.isBuffering) {
                console.log('[Radio] Android: Stream active in background');
              } else if (!refs.current.isRecovering) {
                console.log('[Radio] Android: Stream paused, restarting...');
                await refs.current.sound.playAsync();
              }
            }
          }
        } catch (bgErr) {
          console.warn('[Radio] Error in background transition:', bgErr);
        }
        
        return;
      }
      
      if (nextAppState === 'active') {
        refs.current.isInBackground = false;
        refs.current.backgroundBufferRetries = 0;
        
        if (refs.current.bufferTimeout) {
          clearTimeout(refs.current.bufferTimeout);
          refs.current.bufferTimeout = null;
        }
        
        if (Platform.OS === 'android') {
          try {
            await setupAudio();
          } catch (setupErr) {
            console.warn('[Radio] Error re-setting up audio on Android:', setupErr);
          }
        }
        
        if (refs.current.sound) {
          try {
            const status = await refs.current.sound.getStatusAsync();
            console.log('[Radio] Syncing state after app return:', {
              isLoaded: status?.isLoaded,
              isPlaying: status?.isPlaying,
              currentIsPlaying: refs.current.isPlaying,
            });
            
            if (!refs.current.mounted) return;
            
            if (status && status.isLoaded) {
              if (status.isPlaying) {
                if (!refs.current.isPlaying) {
                  console.log('[Radio] Audio playing but state was wrong, fixing...');
                  refs.current.isPlaying = true;
                  setIsPlaying(true);
                }
                setIsLoading(false);
                setError(null);
                refs.current.lastDataReceived = Date.now();
              } else if (refs.current.isPlaying && !refs.current.isRecovering) {
                console.log('[Radio] Audio stopped while in background, attempting restart...');
                setIsLoading(true);
                
                try {
                  await configureAudioMode();
                  await refs.current.sound.playAsync();
                  console.log('[Radio] Restart playAsync called');
                  
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  const newStatus = await refs.current.sound.getStatusAsync();
                  
                  if (newStatus?.isPlaying) {
                    console.log('[Radio] Restart successful');
                    setIsLoading(false);
                    setError(null);
                    refs.current.lastDataReceived = Date.now();
                  } else {
                    console.log('[Radio] Restart failed, full reconnect needed');
                    refs.current.isRecovering = true;
                    await cleanupSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (refs.current.mounted) {
                      refs.current.isRecovering = false;
                      refs.current.playFn?.();
                    }
                  }
                } catch (restartErr) {
                  console.warn('[Radio] Restart error, full reconnect:', restartErr);
                  refs.current.isRecovering = true;
                  await cleanupSound();
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (refs.current.mounted) {
                    refs.current.isRecovering = false;
                    refs.current.playFn?.();
                  }
                }
              } else {
                console.log('[Radio] Audio stopped while in background');
                refs.current.isPlaying = false;
                setIsPlaying(false);
                setIsLoading(false);
              }
            } else {
              console.log('[Radio] Sound was unloaded while in background');
              if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
                console.log('[Radio] Was playing, attempting full reconnect...');
                refs.current.sound = null;
                refs.current.isRecovering = true;
                await new Promise(resolve => setTimeout(resolve, 500));
                if (refs.current.mounted) {
                  refs.current.isRecovering = false;
                  refs.current.playFn?.();
                }
              } else {
                refs.current.sound = null;
                refs.current.isPlaying = false;
                setIsPlaying(false);
                setIsLoading(false);
              }
            }
          } catch (err) {
            console.warn('[Radio] Error checking status on app return:', err);
            if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
              console.log('[Radio] Error but was playing, attempting reconnect...');
              refs.current.sound = null;
              refs.current.isRecovering = true;
              await new Promise(resolve => setTimeout(resolve, 500));
              if (refs.current.mounted) {
                refs.current.isRecovering = false;
                refs.current.playFn?.();
              }
            } else if (refs.current.mounted) {
              refs.current.sound = null;
              refs.current.isPlaying = false;
              setIsPlaying(false);
              setIsLoading(false);
            }
          }
        } else if (refs.current.isPlaying && !refs.current.isRecovering && refs.current.mounted) {
          console.log('[Radio] No sound but state was playing, attempting reconnect...');
          refs.current.isRecovering = true;
          await new Promise(resolve => setTimeout(resolve, 500));
          if (refs.current.mounted) {
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }
        } else if (refs.current.mounted) {
          refs.current.isPlaying = false;
          setIsPlaying(false);
          setIsLoading(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [setupAudio, configureAudioMode, cleanupSound, refs]);

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
