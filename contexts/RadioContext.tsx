import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';

const STREAM_URL = 'https://castpanel.freedomfm1065.com/listen/freedom_fm_106.5/radio.mp3';

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const setupAudio = async () => {
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
        }
        console.log('Audio setup complete');
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => console.error('Error unloading sound:', err));
      }
    };
  }, []);



  const play = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await soundRef.current.playAsync();
            setIsPlaying(true);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Reusing existing sound failed, creating new one:', e);
        }
      }
      
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn('Error cleaning up previous sound:', e);
        }
        soundRef.current = null;
      }
      
      console.log('Creating new audio stream...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: STREAM_URL },
        { 
          shouldPlay: true, 
          volume,
          isLooping: false,
        },
        null
      );
      
      soundRef.current = newSound;
      setIsPlaying(true);
      console.log('Audio stream started successfully');
    } catch (error: any) {
      console.error('Error playing stream:', error);
      setError('Unable to play stream. Please try again.');
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  }, [volume]);

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
        await soundRef.current.setVolumeAsync(newVolume);
      }
    } catch (error) {
      console.error('Error changing volume:', error);
      setError('Failed to change volume');
    }
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
