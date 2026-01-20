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

const STREAM_TIMEOUT = 15000;

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  
  const soundRef = useRef<any>(null);
  const audioSetupRef = useRef(false);
  const isPlayingRef = useRef(false);
  const isSwitchingRef = useRef(false);

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
        shouldDuckAndroid: true,
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
    } catch (error) {
      console.error('Error setting up audio:', error);
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

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    console.log('Playback status update:', {
      isLoaded: status.isLoaded,
      isPlaying: status.isPlaying,
      isBuffering: status.isBuffering,
      volume: status.volume,
      error: status.error,
    });
    
    if (status.isLoaded) {
      if (status.isPlaying) {
        console.log('Audio is actively playing');
        isPlayingRef.current = true;
        setIsPlaying(true);
        setIsLoading(false);
        setError(null);
      } else if (status.isBuffering) {
        console.log('Audio is buffering...');
        setIsLoading(true);
      } else {
        console.log('Audio loaded but not playing');
        if (!isSwitchingRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
        setIsLoading(false);
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setError('Playback error: ' + status.error);
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, []);

  const cleanupSound = useCallback(async () => {
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
  }, []);

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
        
        const createSoundPromise = Audio.Sound.createAsync(
          { 
            uri: STREAM_URL,
          },
          { 
            shouldPlay: false,
            volume: volume,
            isLooping: false,
            progressUpdateIntervalMillis: 1000,
          },
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
      
      try {
        if (newSound && typeof newSound.playAsync === 'function') {
          console.log('[Radio] Calling playAsync...');
          
          const playPromise = newSound.playAsync();
          const playTimeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Playback start timed out'));
            }, STREAM_TIMEOUT);
          });
          
          await Promise.race([playPromise, playTimeoutPromise]);
          console.log('[Radio] Playback started successfully');
        } else {
          console.error('[Radio] playAsync not available, newSound:', !!newSound);
          throw new Error('playAsync not available on sound object');
        }
      } catch (playError: any) {
        console.error('[Radio] Error starting playback:', playError?.message || playError);
        const errorMsg = playError?.message?.includes('timed out')
          ? 'Stream failed to start. Please try again.'
          : 'Unable to start stream. Please try again.';
        setError(errorMsg);
        await cleanupSound();
        setIsLoading(false);
        return;
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
      
    } catch (error: any) {
      console.error('[Radio] Error playing stream:', error?.message || error);
      console.error('[Radio] Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
      });
      setError('Unable to play stream. Please try again.');
      isPlayingRef.current = false;
      setIsPlaying(false);
      await cleanupSound();
      setIsLoading(false);
    }
  }, [setupAudio, onPlaybackStatusUpdate, volume, updateNowPlaying, cleanupSound]);

  const pause = useCallback(async () => {
    try {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setError(null);
      await cleanupSound();
    } catch (error) {
      console.error('Error pausing stream:', error);
      soundRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [cleanupSound]);

  const stop = useCallback(async () => {
    try {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setError(null);
      await cleanupSound();
    } catch (error) {
      console.error('Error stopping stream:', error);
      soundRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [cleanupSound]);

  const changeVolume = useCallback(async (newVolume: number) => {
    try {
      setVolume(newVolume);
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
    } catch (error) {
      console.error('Error changing volume:', error);
    }
  }, []);

  

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err: any) => console.error('Error unloading sound:', err));
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[Radio] AppState changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            console.log('[Radio] Syncing state after app return:', {
              isLoaded: status?.isLoaded,
              isPlaying: status?.isPlaying,
              currentIsPlaying: isPlayingRef.current,
            });
            
            if (status && status.isLoaded) {
              if (status.isPlaying) {
                if (!isPlayingRef.current) {
                  console.log('[Radio] Audio playing but state was wrong, fixing...');
                  isPlayingRef.current = true;
                  setIsPlaying(true);
                }
                setIsLoading(false);
                setError(null);
              } else {
                console.log('[Radio] Audio stopped while in background');
                isPlayingRef.current = false;
                setIsPlaying(false);
                setIsLoading(false);
              }
            } else {
              console.log('[Radio] Sound was unloaded while in background');
              soundRef.current = null;
              isPlayingRef.current = false;
              setIsPlaying(false);
              setIsLoading(false);
            }
          } catch (err) {
            console.warn('[Radio] Error checking status on app return:', err);
            soundRef.current = null;
            isPlayingRef.current = false;
            setIsPlaying(false);
            setIsLoading(false);
          }
        } else if (isPlayingRef.current) {
          console.log('[Radio] No sound but state was playing, resetting...');
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
  }, []);

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
