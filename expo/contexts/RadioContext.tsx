import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AppState, AppStateStatus, Platform, NativeEventEmitter, NativeModules } from 'react-native';

const STREAM_URL = 'https://castpanel.freedomfm1065.com/hls/freedom_fm_106.5/live.m3u8';
const NOW_PLAYING_API = 'https://castpanel.freedomfm1065.com/api/nowplaying/freedom_fm_106.5';
const LISTENER_POLL_INTERVAL_MS = 30000;

const STREAM_CONNECT_TIMEOUT_MS = 90000;

const HEALTH_CHECK_INTERVAL_MS = Platform.OS === 'android' ? 35000 : 30000;

const STALL_THRESHOLD_MS = Platform.OS === 'android' ? 180000 : 120000;
const BUFFERING_STALL_THRESHOLD_MS = Platform.OS === 'android' ? 150000 : 90000;
const MAX_RETRY_ATTEMPTS = 6;

const PROGRESS_UPDATE_INTERVAL_MS = Platform.OS === 'android' ? 2000 : 1000;

type ExpoAV = typeof import('expo-av');

type NativeSound = import('expo-av').Audio.Sound;

interface RadioRefs {
  mounted: boolean;

  nativeSound: NativeSound | null;
  nativeSub: { remove: () => void } | null;

  webAudio: HTMLAudioElement | null;

  pendingPlay: Promise<void> | null;
  playSessionId: number;

  healthCheck: ReturnType<typeof setInterval> | null;
  retryCount: number;
  consecutiveErrors: number;
  isRecovering: boolean;
  isSwitching: boolean;

  isPlaying: boolean;
  isBuffering: boolean;
  bufferingSince: number;

  desiredPlaying: boolean;
  lastAutoResumeAt: number;

  lastSuccessfulPlay: number;
  lastProgressAt: number;
  lastPositionMs: number;

  lastStatusUpdateAt: number;
  lastNonPlayingAt: number;

  isInBackground: boolean;

  playFn: (() => Promise<void>) | undefined;
  cleanupFn: (() => Promise<void>) | undefined;
}

let expoAVModule: ExpoAV | null = null;
let expoAVLoaded = false;

const loadExpoAV = (): ExpoAV | null => {
  if (Platform.OS === 'web') return null;
  if (expoAVLoaded) return expoAVModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoAVModule = require('expo-av');
    expoAVLoaded = true;
    console.log('[Radio] expo-av module loaded');
    return expoAVModule;
  } catch (e) {
    expoAVLoaded = true;
    console.warn('[Radio] expo-av not available:', e);
    return null;
  }
};

interface NowPlayingData {
  listeners: {
    total: number;
    unique: number;
    current: number;
  };
  live: {
    is_live: boolean;
    streamer_name: string;
  };
  now_playing: {
    song: {
      title: string;
      artist: string;
      album: string;
      art: string;
    };
  };
  station: {
    name: string;
    description: string;
  };
}

export const [RadioProvider, useRadio] = createContextHook(() => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [listenerCount, setListenerCount] = useState<number>(0);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null);

  const listenerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refs = useRef<RadioRefs>({
    mounted: true,

    nativeSound: null,
    nativeSub: null,

    webAudio: null,

    pendingPlay: null,
    playSessionId: 0,

    healthCheck: null,
    retryCount: 0,
    consecutiveErrors: 0,
    isRecovering: false,
    isSwitching: false,

    isPlaying: false,
    isBuffering: false,
    bufferingSince: 0,

    desiredPlaying: false,
    lastAutoResumeAt: 0,

    lastSuccessfulPlay: Date.now(),
    lastProgressAt: Date.now(),
    lastPositionMs: 0,

    lastStatusUpdateAt: Date.now(),
    lastNonPlayingAt: 0,

    isInBackground: false,

    playFn: undefined,
    cleanupFn: undefined,
  });

  const fetchNowPlaying = useCallback(async () => {
    try {
      const response = await fetch(NOW_PLAYING_API);
      if (!response.ok) {
        console.warn('[Radio] Now playing API error:', response.status);
        return;
      }
      const data: NowPlayingData = await response.json();
      if (refs.current.mounted) {
        setListenerCount(data.listeners?.current ?? 0);
        setNowPlaying(data);
      }
      console.log('[Radio] Listener count:', data.listeners?.current);
    } catch (e) {
      console.warn('[Radio] Failed to fetch now playing:', e);
    }
  }, []);

  useEffect(() => {
    if (refs.current.isPlaying && nowPlaying) {
      updateNowPlayingInfo(true);
    }
  }, [nowPlaying, updateNowPlayingInfo]);

  const startListenerPolling = useCallback(() => {
    if (listenerPollRef.current) return;
    fetchNowPlaying();
    listenerPollRef.current = setInterval(fetchNowPlaying, LISTENER_POLL_INTERVAL_MS);
    console.log('[Radio] Started listener polling');
  }, [fetchNowPlaying]);

  const stopListenerPolling = useCallback(() => {
    if (listenerPollRef.current) {
      clearInterval(listenerPollRef.current);
      listenerPollRef.current = null;
      console.log('[Radio] Stopped listener polling');
    }
  }, []);

  const getRetryDelayMs = useCallback((): number => {
    const base = Platform.OS === 'android' ? 1500 : 2000;
    const cappedErrors = Math.min(refs.current.consecutiveErrors, 5);
    const exp = base * Math.pow(1.4, cappedErrors);
    const jitter = Math.random() * 500;
    return Math.min(exp + jitter, 15000);
  }, []);

  const clearHealthCheck = useCallback(() => {
    if (refs.current.healthCheck) {
      clearInterval(refs.current.healthCheck);
      refs.current.healthCheck = null;
    }
  }, []);

  const cleanupWebAudio = useCallback(() => {
    if (!refs.current.webAudio) return;

    console.log('[Radio] Cleaning up web audio');
    const audio = refs.current.webAudio;
    refs.current.webAudio = null;

    refs.current.isBuffering = false;
    refs.current.bufferingSince = 0;

    try {
      audio.oncanplay = null;
      audio.onplaying = null;
      audio.onwaiting = null;
      (audio as any).onstalled = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
      audio.ontimeupdate = null;
      audio.pause();
      audio.src = '';
      audio.load();
    } catch (e) {
      console.warn('[Radio] Web audio cleanup error:', e);
    }
  }, []);

  const cleanupNative = useCallback(async () => {
    if (Platform.OS === 'web') return;

    const sub = refs.current.nativeSub;
    refs.current.nativeSub = null;
    try {
      sub?.remove?.();
    } catch {}

    const sound = refs.current.nativeSound;
    refs.current.nativeSound = null;

    refs.current.isBuffering = false;
    refs.current.bufferingSince = 0;

    if (!sound) return;

    console.log('[Radio] Cleaning up native sound');
    try {
      await sound.stopAsync();
    } catch (e) {
      console.warn('[Radio] stopAsync failed:', e);
    }
    try {
      await sound.unloadAsync();
    } catch (e) {
      console.warn('[Radio] unloadAsync failed:', e);
    }
  }, []);

  const cleanupPlayer = useCallback(async () => {
    clearHealthCheck();

    if (Platform.OS === 'web') {
      cleanupWebAudio();
      return;
    }

    await cleanupNative();
  }, [clearHealthCheck, cleanupNative, cleanupWebAudio]);

  const configureAudioMode = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;

    const expoAV = loadExpoAV();
    if (!expoAV?.Audio?.setAudioModeAsync) return false;

    try {
      const InterruptionModeIOS = (expoAV.Audio as any).InterruptionModeIOS;
      const InterruptionModeAndroid = (expoAV.Audio as any).InterruptionModeAndroid;

      const interruptionModeIOS = InterruptionModeIOS?.DoNotMix ?? 
        (expoAV.Audio as any)?.INTERRUPTION_MODE_IOS_DO_NOT_MIX ?? 2;
      const interruptionModeAndroid = InterruptionModeAndroid?.DoNotMix ?? 
        (expoAV.Audio as any)?.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX ?? 2;

      console.log('[Radio] Configuring audio mode for', Platform.OS, { interruptionModeIOS, interruptionModeAndroid });

      await expoAV.Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS,
        interruptionModeAndroid,
      });
      console.log('[Radio] Audio mode configured successfully for', Platform.OS);
      return true;
    } catch (e) {
      console.warn('[Radio] Failed to configure audio mode:', e);
      return false;
    }
  }, []);

  const updateNowPlayingInfo = useCallback(async (playing: boolean) => {
    if (Platform.OS === 'web') return;
    
    const currentSong = nowPlaying?.now_playing?.song;
    const stationName = nowPlaying?.station?.name || 'Freedom FM 106.5';
    
    try {
      const metadata = {
        title: playing ? (currentSong?.title || 'Live Stream') : 'Freedom FM 106.5',
        artist: playing ? (currentSong?.artist || 'Freedom FM') : 'Tap Play to Listen',
        artwork: currentSong?.art || undefined,
        album: stationName,
      };

      if (Platform.OS === 'ios') {
        const ExpoMusicPicker = NativeModules.ExponentMusicPicker;
        if (ExpoMusicPicker?.updateNowPlaying) {
          await ExpoMusicPicker.updateNowPlaying(metadata);
        }
      }
      
      if (Platform.OS === 'android') {
        const { ExponentAV } = NativeModules;
        if (ExponentAV?.setNowPlayingInfo) {
          await ExponentAV.setNowPlayingInfo(metadata);
        }
      }
      
      console.log('[Radio] Updated now playing info:', metadata);
    } catch (e) {
      console.warn('[Radio] Failed to update now playing info:', e);
    }
  }, [nowPlaying]);

  const buildStreamUri = useCallback((): string => {
    const shouldBustCache = refs.current.retryCount > 0 || refs.current.consecutiveErrors > 0;
    if (!shouldBustCache) return STREAM_URL;
    const sep = STREAM_URL.includes('?') ? '&' : '?';
    return `${STREAM_URL}${sep}t=${Date.now()}`;
  }, []);

  const playWeb = useCallback(async (): Promise<void> => {
    const startSessionId = ++refs.current.playSessionId;
    refs.current.isSwitching = true;

    console.log('[Radio] Web play requested', { startSessionId, desiredPlaying: refs.current.desiredPlaying });

    try {
      setIsLoading(true);
      setError(null);

      cleanupWebAudio();

      const streamUri = buildStreamUri();
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.src = streamUri;
      audio.volume = volume;
      try {
        audio.load();
      } catch {}

      refs.current.webAudio = audio;
      refs.current.lastPositionMs = 0;
      refs.current.lastProgressAt = Date.now();
      refs.current.lastStatusUpdateAt = Date.now();
      refs.current.lastNonPlayingAt = 0;
      refs.current.bufferingSince = 0;

      const connectTimeout = setTimeout(() => {
        if (refs.current.playSessionId !== startSessionId) return;
        console.warn('[Radio] Web connect timeout');
        try {
          audio.pause();
        } catch {}
        refs.current.isPlaying = false;
        refs.current.isBuffering = false;
        refs.current.bufferingSince = 0;
        cleanupWebAudio();
        setIsLoading(false);
        setIsPlaying(false);
        setError('Stream connection timed out. Please try again.');
      }, STREAM_CONNECT_TIMEOUT_MS);

      const finalizeSuccess = () => {
        clearTimeout(connectTimeout);
        if (refs.current.playSessionId !== startSessionId) {
          try {
            audio.pause();
          } catch {}
          return;
        }
        refs.current.isPlaying = true;
        refs.current.isBuffering = false;
        refs.current.bufferingSince = 0;
        refs.current.lastSuccessfulPlay = Date.now();
        refs.current.consecutiveErrors = 0;
        refs.current.retryCount = 0;

        if (refs.current.mounted) {
          setIsPlaying(true);
          setIsLoading(false);
          setError(null);
        }
      };

      audio.onplaying = () => {
        console.log('[Radio] Web audio playing');
        finalizeSuccess();
      };

      audio.onwaiting = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        if (!refs.current.isBuffering) {
          refs.current.bufferingSince = Date.now();
        }
        refs.current.isBuffering = true;
        console.log('[Radio] Web buffering');
      };

      (audio as any).onstalled = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        if (!refs.current.isBuffering) {
          refs.current.bufferingSince = Date.now();
        }
        refs.current.isBuffering = true;
        console.warn('[Radio] Web stalled');
      };

      audio.onpause = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        if (!refs.current.isSwitching && !refs.current.isRecovering && refs.current.mounted) {
          refs.current.isPlaying = false;
          setIsPlaying(false);
        }
      };

      audio.onerror = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        clearTimeout(connectTimeout);
        console.error('[Radio] Web audio error');
        refs.current.consecutiveErrors++;
        refs.current.isPlaying = false;
        refs.current.isBuffering = false;
        refs.current.bufferingSince = 0;
        cleanupWebAudio();
        if (refs.current.mounted) {
          setIsPlaying(false);
          setIsLoading(false);
          setError('Unable to play stream. Please try again.');
        }
      };

      audio.onended = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        console.warn('[Radio] Web stream ended');
        if (!refs.current.isRecovering && refs.current.mounted) {
          refs.current.isRecovering = true;
          const delay = getRetryDelayMs();
          setTimeout(() => {
            if (!refs.current.mounted) return;
            if (refs.current.playSessionId !== startSessionId) return;
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }, delay);
        }
      };

      audio.ontimeupdate = () => {
        if (refs.current.playSessionId !== startSessionId) return;
        const now = Date.now();
        refs.current.lastStatusUpdateAt = now;
        const positionMs = Math.floor(audio.currentTime * 1000);
        if (positionMs !== refs.current.lastPositionMs) {
          refs.current.lastPositionMs = positionMs;
          refs.current.lastProgressAt = now;
          
          if (refs.current.isBuffering) {
            refs.current.isBuffering = false;
            refs.current.bufferingSince = 0;
            if (refs.current.mounted) setIsLoading(false);
          }
        }
        
        if (refs.current.isBuffering && refs.current.bufferingSince > 0) {
          const bufferingDuration = now - refs.current.bufferingSince;
          if (bufferingDuration > 3000 && refs.current.mounted) {
            setIsLoading(true);
          }
        }
      };

      await audio.play();

      refs.current.isSwitching = false;
    } catch (e: any) {
      console.error('[Radio] Web play failed:', e?.message || e);
      refs.current.consecutiveErrors++;
      refs.current.isPlaying = false;
      refs.current.isSwitching = false;
      cleanupWebAudio();
      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
        setError('Unable to play stream. Please try again.');
      }
    }
  }, [buildStreamUri, cleanupWebAudio, getRetryDelayMs, volume]);

  const playNative = useCallback(async (): Promise<void> => {
    const expoAV = loadExpoAV();
    if (!expoAV?.Audio?.Sound) {
      setError('Audio module not available. Please restart the app.');
      setIsLoading(false);
      return;
    }

    const startSessionId = ++refs.current.playSessionId;
    refs.current.isSwitching = true;

    console.log('[Radio] Native play requested', {
      startSessionId,
      platform: Platform.OS,
      desiredPlaying: refs.current.desiredPlaying,
    });

    try {
      setIsLoading(true);
      setError(null);

      await configureAudioMode();
      await cleanupNative();

      if (refs.current.playSessionId !== startSessionId) {
        console.log('[Radio] Native play aborted (session changed after cleanup)');
        return;
      }

      const streamUri = buildStreamUri();

      const sound = new expoAV.Audio.Sound();
      refs.current.nativeSound = sound;

      refs.current.lastPositionMs = 0;
      refs.current.lastProgressAt = Date.now();
      refs.current.lastStatusUpdateAt = Date.now();
      refs.current.lastNonPlayingAt = 0;
      refs.current.bufferingSince = 0;

      const onStatus = (status: import('expo-av').AVPlaybackStatus) => {
        if (!refs.current.mounted) return;
        if (refs.current.playSessionId !== startSessionId) return;

        refs.current.lastStatusUpdateAt = Date.now();

        if (!status.isLoaded) {
          if (status.error) {
            console.error('[Radio] Native status error:', status.error);
          }
          return;
        }

        const now = Date.now();

        if (typeof status.positionMillis === 'number') {
          if (status.positionMillis !== refs.current.lastPositionMs) {
            refs.current.lastPositionMs = status.positionMillis;
            refs.current.lastProgressAt = now;
          }
        }

        if (status.isPlaying) {
          refs.current.isPlaying = true;
          refs.current.isBuffering = false;
          refs.current.bufferingSince = 0;
          refs.current.lastSuccessfulPlay = now;
          refs.current.lastProgressAt = now;
          refs.current.lastNonPlayingAt = 0;
          refs.current.consecutiveErrors = 0;
          refs.current.retryCount = 0;
          if (refs.current.mounted) {
            setIsPlaying(true);
            setIsLoading(false);
            setError(null);
          }
          updateNowPlayingInfo(true);
          return;
        }

        if (status.isBuffering) {
          if (!refs.current.isBuffering) {
            refs.current.bufferingSince = now;
          }
          refs.current.isBuffering = true;
          refs.current.lastProgressAt = now;
          const bufferingDuration = now - refs.current.bufferingSince;
          if (refs.current.mounted && bufferingDuration > 1500) {
            setIsLoading(true);
          }
          return;
        }

        refs.current.isPlaying = false;
        refs.current.isBuffering = false;
        refs.current.bufferingSince = 0;
        if (refs.current.lastNonPlayingAt === 0) refs.current.lastNonPlayingAt = now;
        if (refs.current.mounted) setIsPlaying(false);
        updateNowPlayingInfo(false);

        const shouldAutoResume =
          refs.current.desiredPlaying &&
          !refs.current.isRecovering &&
          !refs.current.isSwitching &&
          !refs.current.isInBackground;

        if (!shouldAutoResume) return;

        const stoppedForMs = now - (refs.current.lastNonPlayingAt || now);
        if (stoppedForMs < 5000) {
          console.log('[Radio] Not auto-resuming yet (transient pause)', { stoppedForMs });
          return;
        }

        if (now - refs.current.lastAutoResumeAt < 10000) return;
        refs.current.lastAutoResumeAt = now;

        console.warn('[Radio] Playback stopped (likely interruption). Auto-resuming...', {
          platform: Platform.OS,
          didJustFinish: (status as any)?.didJustFinish,
          stoppedForMs,
        });

        refs.current.isRecovering = true;
        if (refs.current.mounted) setIsLoading(true);
        cleanupPlayer()
          .catch((e) => console.warn('[Radio] cleanup after interruption failed:', e))
          .finally(() => {
            const delay = getRetryDelayMs();
            setTimeout(() => {
              if (!refs.current.mounted) return;
              if (refs.current.playSessionId !== startSessionId) return;
              refs.current.isRecovering = false;
              refs.current.playFn?.();
            }, delay);
          });
      };

      const connectTimer = setTimeout(() => {
        if (!refs.current.mounted) return;
        if (refs.current.playSessionId !== startSessionId) return;
        console.warn('[Radio] Native connect timeout');
        refs.current.consecutiveErrors++;
        setIsLoading(false);
        setIsPlaying(false);
        refs.current.isPlaying = false;
        setError('Stream connection timed out. Please try again.');
        refs.current.cleanupFn?.();
      }, STREAM_CONNECT_TIMEOUT_MS);

      try {
        refs.current.nativeSub = sound.setOnPlaybackStatusUpdate(onStatus) as unknown as { remove: () => void };
      } catch {
        sound.setOnPlaybackStatusUpdate(onStatus);
      }

      const loadWithAndroidImpl = async (androidImplementation: 'MediaPlayer' | 'ExoPlayer') => {
        console.log('[Radio] Loading stream', { platform: Platform.OS, androidImplementation, streamUri });
        
        const sourceConfig: any = {
          uri: streamUri,
          headers: {
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, audio/mpegurl, audio/x-mpegurl, */*',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
          },
        };

        if (Platform.OS === 'android') {
          sourceConfig.overrideFileExtensionAndroid = 'm3u8';
        }

        const initialStatus: any = {
          shouldPlay: false,
          volume,
          progressUpdateIntervalMillis: PROGRESS_UPDATE_INTERVAL_MS,
        };

        if (Platform.OS === 'android') {
          initialStatus.androidImplementation = androidImplementation;
        }

        await sound.loadAsync(sourceConfig, initialStatus);
        console.log('[Radio] Stream loaded successfully on', Platform.OS);
      };

      if (Platform.OS === 'ios') {
        try {
          await loadWithAndroidImpl('ExoPlayer');
        } catch (e) {
          console.error('[Radio] iOS load failed:', e);
          throw e;
        }
      } else {
        try {
          await loadWithAndroidImpl('ExoPlayer');
        } catch (e) {
          console.warn('[Radio] ExoPlayer load failed, retrying with MediaPlayer', e);
          await cleanupNative();
          if (refs.current.playSessionId !== startSessionId) return;

          const fallbackSound = new expoAV.Audio.Sound();
          refs.current.nativeSound = fallbackSound;
          try {
            refs.current.nativeSub = fallbackSound.setOnPlaybackStatusUpdate(onStatus) as unknown as { remove: () => void };
          } catch {
            fallbackSound.setOnPlaybackStatusUpdate(onStatus);
          }

          const fallbackSource: any = {
            uri: streamUri,
            headers: {
              'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, audio/mpegurl, */*',
              'Connection': 'keep-alive',
              'Cache-Control': 'no-cache',
            },
            overrideFileExtensionAndroid: 'm3u8',
          };

          await fallbackSound.loadAsync(
            fallbackSource,
            {
              shouldPlay: false,
              volume,
              progressUpdateIntervalMillis: PROGRESS_UPDATE_INTERVAL_MS,
              androidImplementation: 'MediaPlayer' as const,
            }
          );
        }
      }

      clearTimeout(connectTimer);

      if (refs.current.playSessionId !== startSessionId) {
        console.log('[Radio] Native play aborted (session changed after load)');
        return;
      }

      const currentSound = refs.current.nativeSound;
      if (!currentSound) {
        console.warn('[Radio] No sound instance available for playAsync');
        throw new Error('Sound instance not available');
      }

      try {
        const status = await currentSound.getStatusAsync();
        if (!status.isLoaded) {
          console.warn('[Radio] Sound not loaded before playAsync');
          throw new Error('Sound not loaded');
        }
        await currentSound.playAsync();
      } catch (e) {
        console.warn('[Radio] playAsync failed after load:', e);
        throw e;
      }

      refs.current.isSwitching = false;
    } catch (e: any) {
      console.error('[Radio] Native play failed:', e?.message || e);
      refs.current.consecutiveErrors++;
      refs.current.isPlaying = false;
      refs.current.isSwitching = false;

      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
        setError('Unable to play stream. Please try again.');
      }

      await cleanupNative();
    }
  }, [buildStreamUri, cleanupNative, cleanupPlayer, configureAudioMode, getRetryDelayMs, volume]);

  const play = useCallback(async (): Promise<void> => {
    console.log('[Radio] Play called', {
      isRecovering: refs.current.isRecovering,
      pendingPlay: !!refs.current.pendingPlay,
      isPlaying: refs.current.isPlaying,
      desiredPlaying: refs.current.desiredPlaying,
    });

    refs.current.desiredPlaying = true;

    if (refs.current.isRecovering) {
      console.log('[Radio] Play: clearing stuck recovery state');
      refs.current.isRecovering = false;
    }

    if (refs.current.pendingPlay) {
      const pendingAge = Date.now() - refs.current.lastStatusUpdateAt;
      if (pendingAge > 30000) {
        console.warn('[Radio] Play: clearing stale pending play (age:', pendingAge, 'ms)');
        refs.current.pendingPlay = null;
        refs.current.playSessionId++;
        await cleanupPlayer().catch(() => {});
      } else {
        console.log('[Radio] Play ignored: pending play in progress');
        return refs.current.pendingPlay;
      }
    }

    const playPromise = (async () => {
      if (Platform.OS === 'web') {
        await playWeb();
      } else {
        await playNative();
      }

      clearHealthCheck();
      const sessionForChecks = refs.current.playSessionId;

      refs.current.healthCheck = setInterval(async () => {
        if (!refs.current.mounted) return;
        if (refs.current.playSessionId !== sessionForChecks) return;
        if (!refs.current.desiredPlaying) return;
        if (refs.current.isRecovering) return;

        const now = Date.now();
        const stalledFor = now - refs.current.lastProgressAt;
        const statusQuietFor = now - refs.current.lastStatusUpdateAt;

        const bufferingFor =
          refs.current.isBuffering && refs.current.bufferingSince > 0 ? now - refs.current.bufferingSince : 0;

        if (refs.current.isBuffering) {
          if (bufferingFor < BUFFERING_STALL_THRESHOLD_MS) return;
          if (statusQuietFor < BUFFERING_STALL_THRESHOLD_MS) return;
        } else {
          if (stalledFor < STALL_THRESHOLD_MS) return;
          if (statusQuietFor < STALL_THRESHOLD_MS) return;
        }

        console.warn('[Radio] Stall detected, recovering...', {
          platform: Platform.OS,
          stalledFor,
          statusQuietFor,
          bufferingFor,
          retryCount: refs.current.retryCount,
          isBuffering: refs.current.isBuffering,
        });

        if (refs.current.retryCount >= MAX_RETRY_ATTEMPTS) {
          console.warn('[Radio] Max retry attempts reached');
          if (refs.current.mounted) {
            setError('Stream is unstable. Please try again in a moment.');
            setIsLoading(false);
            setIsPlaying(false);
          }
          refs.current.isPlaying = false;
          await cleanupPlayer();
          return;
        }

        refs.current.retryCount++;
        refs.current.isRecovering = true;
        if (refs.current.mounted) setIsLoading(true);

        await cleanupPlayer();

        const delay = getRetryDelayMs();
        setTimeout(() => {
          if (!refs.current.mounted) return;
          if (refs.current.playSessionId !== sessionForChecks) return;
          refs.current.isRecovering = false;
          refs.current.playFn?.();
        }, delay);
      }, HEALTH_CHECK_INTERVAL_MS);
    })();

    refs.current.pendingPlay = playPromise.finally(() => {
      if (refs.current.pendingPlay === playPromise) {
        refs.current.pendingPlay = null;
      }
    });

    return refs.current.pendingPlay;
  }, [clearHealthCheck, cleanupPlayer, getRetryDelayMs, playNative, playWeb]);

  const forceReset = useCallback(async (): Promise<void> => {
    console.log('[Radio] Force reset triggered');
    refs.current.desiredPlaying = false;
    refs.current.playSessionId++;
    refs.current.pendingPlay = null;
    refs.current.isRecovering = false;
    refs.current.isSwitching = false;
    refs.current.isPlaying = false;
    refs.current.isBuffering = false;
    refs.current.bufferingSince = 0;
    refs.current.retryCount = 0;
    refs.current.consecutiveErrors = 0;
    refs.current.lastNonPlayingAt = 0;

    if (refs.current.mounted) {
      setIsPlaying(false);
      setIsLoading(false);
      setError(null);
    }

    try {
      await cleanupPlayer();
    } catch (e) {
      console.warn('[Radio] Force reset cleanup error:', e);
    }
  }, [cleanupPlayer]);

  const pause = useCallback(async (): Promise<void> => {
    try {
      console.log('[Radio] Pause called', {
        isRecovering: refs.current.isRecovering,
        pendingPlay: !!refs.current.pendingPlay,
        isPlaying: refs.current.isPlaying,
      });

      refs.current.desiredPlaying = false;
      refs.current.playSessionId++;
      refs.current.pendingPlay = null;
      refs.current.isRecovering = false;
      refs.current.isSwitching = false;
      refs.current.isPlaying = false;
      refs.current.isBuffering = false;
      refs.current.bufferingSince = 0;

      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
        setError(null);
      }

      updateNowPlayingInfo(false);
      await cleanupPlayer();
    } catch (e) {
      console.error('[Radio] Pause failed:', e);
      refs.current.isPlaying = false;
      refs.current.pendingPlay = null;
      refs.current.isRecovering = false;
      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
      }
    }
  }, [cleanupPlayer, updateNowPlayingInfo]);

  const toggle = useCallback(async (): Promise<void> => {
    console.log('[Radio] Toggle called', {
      isPlaying: refs.current.isPlaying,
      stateIsPlaying: isPlaying,
      isLoading,
      isRecovering: refs.current.isRecovering,
      pendingPlay: !!refs.current.pendingPlay,
    });

    const isStuck =
      refs.current.isRecovering ||
      (refs.current.pendingPlay && Date.now() - refs.current.lastStatusUpdateAt > 30000);

    if (isStuck) {
      console.warn('[Radio] Toggle: detected stuck state, forcing reset first');
      await forceReset();
      await new Promise((r) => setTimeout(r, 300));
      await play();
      return;
    }

    if (isPlaying || refs.current.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [forceReset, isPlaying, isLoading, pause, play]);

  const stop = useCallback(async (): Promise<void> => {
    try {
      refs.current.desiredPlaying = false;
      refs.current.playSessionId++;
      refs.current.pendingPlay = null;
      refs.current.isRecovering = false;
      refs.current.isSwitching = false;
      refs.current.isPlaying = false;
      refs.current.isBuffering = false;
      refs.current.bufferingSince = 0;

      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
        setError(null);
      }

      updateNowPlayingInfo(false);
      await cleanupPlayer();
    } catch (e) {
      console.error('[Radio] Stop failed:', e);
      refs.current.isPlaying = false;
      if (refs.current.mounted) setIsPlaying(false);
    }
  }, [cleanupPlayer, updateNowPlayingInfo]);

  const changeVolume = useCallback(async (newVolume: number): Promise<void> => {
    try {
      if (refs.current.mounted) setVolume(newVolume);

      if (Platform.OS === 'web') {
        if (refs.current.webAudio) refs.current.webAudio.volume = newVolume;
        return;
      }

      if (refs.current.nativeSound) {
        try {
          await refs.current.nativeSound.setVolumeAsync(newVolume);
        } catch (e) {
          console.warn('[Radio] setVolumeAsync failed:', e);
        }
      }
    } catch (e) {
      console.error('[Radio] Change volume failed:', e);
    }
  }, []);

  useEffect(() => {
    refs.current.playFn = play;
    refs.current.cleanupFn = cleanupPlayer;
  }, [play, cleanupPlayer]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    console.log('[Radio] Setting up audio mode for platform:', Platform.OS);
    configureAudioMode()
      .then((success) => {
        console.log('[Radio] Initial audio mode setup result:', success);
      })
      .catch((e) => console.warn('[Radio] Initial audio mode setup failed:', e));
  }, [configureAudioMode]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let remoteControlSubscription: { remove: () => void } | null = null;

    const setupRemoteControls = async () => {
      try {
        const { ExponentAV } = NativeModules;
        if (!ExponentAV) return;

        const eventEmitter = new NativeEventEmitter(ExponentAV);
        
        remoteControlSubscription = eventEmitter.addListener('onRemoteControl', (event: { type: string }) => {
          console.log('[Radio] Remote control event:', event.type);
          
          switch (event.type) {
            case 'play':
              if (!refs.current.isPlaying) {
                play();
              }
              break;
            case 'pause':
              if (refs.current.isPlaying) {
                pause();
              }
              break;
            case 'togglePlayPause':
              toggle();
              break;
            case 'stop':
              stop();
              break;
            default:
              break;
          }
        }) as unknown as { remove: () => void };

        console.log('[Radio] Remote controls setup complete');
      } catch (e) {
        console.warn('[Radio] Failed to setup remote controls:', e);
      }
    };

    setupRemoteControls();

    return () => {
      remoteControlSubscription?.remove?.();
    };
  }, [pause, play, stop, toggle]);

  useEffect(() => {
    refs.current.mounted = true;
    startListenerPolling();
    return () => {
      refs.current.mounted = false;
      stopListenerPolling();
    };
  }, [startListenerPolling, stopListenerPolling]);

  useEffect(() => {
    return () => {
      const current = refs.current;
      current.playSessionId++;
      current.pendingPlay = null;
      current.isRecovering = false;
      current.isSwitching = false;
      current.isPlaying = false;

      clearHealthCheck();

      if (Platform.OS === 'web') {
        cleanupWebAudio();
      } else {
        cleanupNative().catch(() => undefined);
      }
    };
  }, [clearHealthCheck, cleanupNative, cleanupWebAudio]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const sessionAtStart = refs.current.playSessionId;

      console.log('[Radio] AppState changed:', nextAppState, { sessionAtStart });

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        refs.current.isInBackground = true;
        return;
      }

      if (nextAppState === 'active') {
        refs.current.isInBackground = false;

        console.log('[Radio] App became active', {
          desiredPlaying: refs.current.desiredPlaying,
          isRecovering: refs.current.isRecovering,
          isPlaying: refs.current.isPlaying,
          pendingPlay: !!refs.current.pendingPlay,
        });

        if (!refs.current.desiredPlaying) {
          refs.current.pendingPlay = null;
          refs.current.isRecovering = false;
          return;
        }

        if (refs.current.isRecovering) {
          const recoveryAge = Date.now() - refs.current.lastStatusUpdateAt;
          if (recoveryAge > 30000) {
            console.warn('[Radio] Clearing stuck recovery on app resume (age:', recoveryAge, 'ms)');
            refs.current.isRecovering = false;
            refs.current.pendingPlay = null;
          } else {
            return;
          }
        }

        if (refs.current.playSessionId !== sessionAtStart) return;

        const sound = refs.current.nativeSound;
        if (!sound) {
          console.warn('[Radio] No native sound on return; reconnecting');
          refs.current.isRecovering = true;
          const delay = getRetryDelayMs();
          setTimeout(() => {
            if (!refs.current.mounted) return;
            if (refs.current.playSessionId !== sessionAtStart) return;
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }, delay);
          return;
        }

        try {
          const status = await sound.getStatusAsync();
          if (!status.isLoaded) {
            console.warn('[Radio] Sound not loaded on return; reconnecting');
            throw new Error('not-loaded');
          }

          if (status.isPlaying) {
            refs.current.lastProgressAt = Date.now();
            if (refs.current.mounted) {
              setIsPlaying(true);
              setIsLoading(false);
              setError(null);
            }
            return;
          }

          if (status.isBuffering) {
            if (refs.current.mounted) setIsLoading(true);
            return;
          }

          console.warn('[Radio] Sound stopped on return; reconnecting');
          throw new Error('stopped');
        } catch {
          if (refs.current.isRecovering) return;
          refs.current.isRecovering = true;
          if (refs.current.mounted) setIsLoading(true);
          await cleanupPlayer();
          const delay = getRetryDelayMs();
          setTimeout(() => {
            if (!refs.current.mounted) return;
            if (refs.current.playSessionId !== sessionAtStart) return;
            refs.current.isRecovering = false;
            refs.current.playFn?.();
          }, delay);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [cleanupPlayer, getRetryDelayMs]);

  return useMemo(
    () => ({
      isPlaying,
      isLoading,
      volume,
      error,
      listenerCount,
      nowPlaying,
      play,
      pause,
      stop,
      toggle,
      forceReset,
      changeVolume,
      refreshNowPlaying: fetchNowPlaying,
    }),
    [changeVolume, error, fetchNowPlaying, forceReset, isLoading, isPlaying, listenerCount, nowPlaying, pause, play, stop, toggle, volume]
  );
});
