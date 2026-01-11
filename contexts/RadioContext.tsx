import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';

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
    if (ExpoAV && ExpoAV.Audio) {
      Audio = ExpoAV.Audio;
      InterruptionModeAndroid = ExpoAV.InterruptionModeAndroid;
      InterruptionModeIOS = ExpoAV.InterruptionModeIOS;
      audioModuleLoaded = true;
      return true;
    }
    return false;
  } catch (error) {
    console.warn('expo-av not available:', error);
    return false;
  }
};

const STREAM_URLS = {
  version1: 'https://media.slactech.com:8012/stream',
  version2: 'https://castpanel.freedomfm1065.com/listen/freedom_fm_106.5/mobile.mp3',
} as const;

type StreamVersion = keyof typeof STREAM_URLS;

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState<StreamVersion>('version1');
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

  const updateNowPlaying = useCallback(async (isPlaying: boolean) => {
    if (Platform.OS === 'web') return;
    
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setProgressUpdateIntervalAsync(1000);
        }
      }
      console.log('Now Playing info updated');
    } catch (error) {
      console.error('Error updating Now Playing info:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err: any) => console.error('Error unloading sound:', err));
      }
    };
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
    if (!soundRef.current) return;
    
    try {
      const sound = soundRef.current;
      soundRef.current = null;
      
      try {
        const status = await sound.getStatusAsync();
        if (status && status.isLoaded) {
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
        }
      } catch {
        try {
          await sound.unloadAsync();
        } catch (unloadErr) {
          console.warn('Final cleanup error:', unloadErr);
        }
      }
      console.log('Sound cleanup completed');
    } catch (e) {
      console.warn('Error during sound cleanup:', e);
      soundRef.current = null;
    }
  }, []);

  const play = useCallback(async (streamVersion?: StreamVersion) => {
    if (Platform.OS === 'web') {
      setError('Audio playback is not supported on web. Please use the mobile app.');
      setIsLoading(false);
      return;
    }
    
    const moduleLoaded = loadAudioModule();
    if (!moduleLoaded || !Audio) {
      setError('Audio module not available. Please restart the app.');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const audioSetupSuccess = await setupAudio();
      if (!audioSetupSuccess) {
        setError('Failed to initialize audio. Please restart the app.');
        setIsLoading(false);
        return;
      }
      
      const streamToUse = streamVersion || currentStream;
      const streamUrl = STREAM_URLS[streamToUse];
      
      console.log('Play requested...');
      console.log('Stream URL:', streamUrl);
      console.log('Stream Version:', streamToUse);
      
      await cleanupSound();
      
      console.log('Creating new audio stream...');
      
      let newSound: any = null;
      
      try {
        if (!Audio || !Audio.Sound || typeof Audio.Sound.createAsync !== 'function') {
          throw new Error('Audio.Sound not properly initialized');
        }
        
        const result = await Audio.Sound.createAsync(
          { 
            uri: streamUrl,
          },
          { 
            shouldPlay: false,
            volume: volume,
            isLooping: false,
            progressUpdateIntervalMillis: 1000,
          },
          onPlaybackStatusUpdate
        );
        
        if (!result || !result.sound) {
          throw new Error('Failed to create sound object');
        }
        
        newSound = result.sound;
      } catch (createError: any) {
        console.error('Error creating audio:', createError);
        setError('Unable to load stream. Please check your connection and try again.');
        setIsLoading(false);
        return;
      }
      
      soundRef.current = newSound;
      setCurrentStream(streamToUse);
      console.log('New sound created successfully');
      
      try {
        if (newSound && typeof newSound.playAsync === 'function') {
          await newSound.playAsync();
          console.log('Playback started successfully');
        } else {
          throw new Error('playAsync not available on sound object');
        }
      } catch (playError: any) {
        console.error('Error starting playback:', playError);
        setError('Unable to start playback. Please try again.');
        await cleanupSound();
        setIsLoading(false);
        return;
      }
      
      try {
        await updateNowPlaying(true);
      } catch (nowPlayingError) {
        console.warn('Error updating now playing:', nowPlayingError);
      }
      
      try {
        if (newSound && typeof newSound.getStatusAsync === 'function') {
          const status = await newSound.getStatusAsync();
          console.log('Sound status after creation:', {
            isLoaded: status?.isLoaded,
            isPlaying: status?.isLoaded && status?.isPlaying,
            volume: status?.isLoaded && status?.volume,
          });
        }
      } catch (statusError) {
        console.warn('Error getting status:', statusError);
      }
      
    } catch (error: any) {
      console.error('Error playing stream:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
      });
      setError('Unable to play stream. Please try again.');
      isPlayingRef.current = false;
      setIsPlaying(false);
      await cleanupSound();
      setIsLoading(false);
    }
  }, [setupAudio, onPlaybackStatusUpdate, currentStream, volume, updateNowPlaying, cleanupSound]);

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

  const switchStream = useCallback(async (streamVersion: StreamVersion) => {
    if (isSwitchingRef.current) {
      console.log('Already switching, ignoring request');
      return;
    }
    
    try {
      isSwitchingRef.current = true;
      console.log('Switching to stream:', streamVersion);
      const wasPlaying = isPlayingRef.current;
      
      setIsLoading(true);
      setError(null);
      
      isPlayingRef.current = false;
      setIsPlaying(false);
      
      await cleanupSound();
      
      setCurrentStream(streamVersion);
      
      if (wasPlaying) {
        await new Promise(resolve => setTimeout(resolve, 150));
        await play(streamVersion);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error switching stream:', error);
      setError('Failed to switch stream. Please try again.');
      setIsLoading(false);
    } finally {
      isSwitchingRef.current = false;
    }
  }, [play, cleanupSound]);

  return useMemo(
    () => ({
      isPlaying,
      isLoading,
      volume,
      error,
      currentStream,
      play,
      pause,
      stop,
      changeVolume,
      switchStream,
    }),
    [isPlaying, isLoading, volume, error, currentStream, play, pause, stop, changeVolume, switchStream]
  );
});
