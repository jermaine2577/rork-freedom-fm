import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';

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
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioSetupRef = useRef(false);

  const setupAudio = useCallback(async () => {
    if (audioSetupRef.current) return;
    audioSetupRef.current = true;
    
    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
        });
        console.log('Audio setup complete (native)');
      } else {
        console.log('Audio setup complete (web)');
      }
    } catch (error) {
      console.error('Error setting up audio:', error);
      audioSetupRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => console.error('Error unloading sound:', err));
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
        setIsPlaying(true);
        setIsLoading(false);
        setError(null);
      } else if (status.isBuffering) {
        console.log('Audio is buffering...');
        setIsLoading(true);
      } else {
        console.log('Audio loaded but not playing');
        setIsPlaying(false);
        setIsLoading(false);
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setError('Playback error: ' + status.error);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(async (streamVersion?: StreamVersion) => {
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
          await soundRef.current.unloadAsync();
          console.log('Previous sound unloaded');
        } catch (e) {
          console.warn('Error cleaning up previous sound:', e);
        }
        soundRef.current = null;
      }
      
      console.log('Creating new audio stream...');
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { 
          shouldPlay: true, 
          volume: volume,
          isLooping: false,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = newSound;
      setCurrentStream(streamToUse);
      console.log('New sound created and should be playing');
      
      await newSound.playAsync();
      console.log('Explicitly called playAsync');
      
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
  }, [setupAudio, onPlaybackStatusUpdate, currentStream, volume]);

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setError(null);
      }
    } catch (error) {
      console.error('Error pausing stream:', error);
      setError('Failed to pause stream');
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setIsPlaying(false);
        setError(null);
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
      soundRef.current = null;
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
    console.log('Switching to stream:', streamVersion);
    const wasPlaying = isPlaying;
    
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.warn('Error unloading sound:', e);
      }
      soundRef.current = null;
    }
    
    setIsPlaying(false);
    setCurrentStream(streamVersion);
    
    if (wasPlaying) {
      await play(streamVersion);
    }
  }, [isPlaying, play]);

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
