import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';

let Audio: any = null;
let InterruptionModeAndroid: any = null;
let InterruptionModeIOS: any = null;
let audioModuleLoaded = false;

const loadAudioModule = () => {
  if (audioModuleLoaded || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoAV = require('expo-av');
    Audio = ExpoAV.Audio;
    InterruptionModeAndroid = ExpoAV.InterruptionModeAndroid;
    InterruptionModeIOS = ExpoAV.InterruptionModeIOS;
    audioModuleLoaded = true;
  } catch (error) {
    console.warn('expo-av not available:', error);
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

  const setupAudio = useCallback(async () => {
    if (audioSetupRef.current) return;
    if (Platform.OS === 'web') {
      console.log('Audio not supported on web');
      return;
    }
    
    loadAudioModule();
    
    if (!Audio) {
      console.warn('Audio module not available');
      return;
    }
    
    try {
      audioSetupRef.current = true;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
      audioSetupRef.current = false;
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

  const play = useCallback(async (streamVersion?: StreamVersion) => {
    if (Platform.OS === 'web') {
      setError('Audio playback is not supported on web. Please use the mobile app.');
      setIsLoading(false);
      return;
    }
    
    loadAudioModule();
    
    if (!Audio) {
      setError('Audio module not available');
      return;
    }
    
    try {
      await setupAudio();
      
      setIsLoading(true);
      setError(null);
      
      const streamToUse = streamVersion || currentStream;
      const streamUrl = STREAM_URLS[streamToUse];
      
      console.log('Play requested...');
      console.log('Stream URL:', streamUrl);
      console.log('Stream Version:', streamToUse);
      
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          }
          console.log('Previous sound unloaded');
        } catch (e) {
          console.warn('Error cleaning up previous sound:', e);
        }
        soundRef.current = null;
      }
      
      console.log('Creating new audio stream...');
      
      let newSound: any = null;
      
      try {
        const result = await Audio.Sound.createAsync(
          { 
            uri: streamUrl,
            headers: {
              'User-Agent': 'FreedomFM/1.0',
            },
          },
          { 
            shouldPlay: false,
            volume: volume,
            isLooping: false,
            progressUpdateIntervalMillis: 500,
          },
          onPlaybackStatusUpdate
        );
        newSound = result.sound;
      } catch (createError: any) {
        console.error('Error creating audio:', createError);
        setError('Unable to load stream. Please try again.');
        setIsLoading(false);
        return;
      }
      
      if (!newSound) {
        setError('Failed to create audio player');
        setIsLoading(false);
        return;
      }
      
      soundRef.current = newSound;
      setCurrentStream(streamToUse);
      console.log('New sound created');
      
      try {
        await newSound.playAsync();
        console.log('Playback started successfully');
      } catch (playError: any) {
        console.error('Error starting playback:', playError);
        setError('Unable to start playback. Please try again.');
        setIsLoading(false);
        return;
      }
      
      await updateNowPlaying(true);
      
      const status = await newSound.getStatusAsync();
      console.log('Sound status after creation:', {
        isLoaded: status.isLoaded,
        isPlaying: status.isLoaded && status.isPlaying,
        volume: status.isLoaded && status.volume,
      });
      
    } catch (error: any) {
      console.error('Error playing stream:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      setError('Unable to play stream: ' + (error.message || 'Unknown error'));
      setIsPlaying(false);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setIsLoading(false);
    }
  }, [setupAudio, onPlaybackStatusUpdate, currentStream, volume, updateNowPlaying]);

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
        soundRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setError(null);
      }
    } catch (error) {
      console.error('Error pausing stream:', error);
      soundRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setError(null);
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
      soundRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  const changeVolume = useCallback(async (newVolume: number) => {
    try {
      setVolume(newVolume);
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setVolumeAsync(newVolume);
          console.log('Volume changed to:', newVolume);
        }
      }
    } catch (error) {
      console.error('Error changing volume:', error);
      setError('Failed to change volume');
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
      
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn('Error unloading sound:', e);
        }
        soundRef.current = null;
      }
      
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentStream(streamVersion);
      
      if (wasPlaying) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await play(streamVersion);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error switching stream:', error);
      setError('Failed to switch stream');
      setIsLoading(false);
    } finally {
      isSwitchingRef.current = false;
    }
  }, [play]);

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
