import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AppState, AppStateStatus, Platform } from 'react-native';

const ARTWORK_URI: string =
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/b3vamp0ku602q6ojiaqvd';

const STREAM_URL = 'https://castpanel.freedomfm1065.com/hls/freedom_fm_106.5/live.m3u8';
const NOW_PLAYING_API = 'https://castpanel.freedomfm1065.com/api/nowplaying/freedom_fm_106.5';
const LISTENER_POLL_INTERVAL_MS = 30000;
const STREAM_CONNECT_TIMEOUT_MS = 60000;

type ExpoVideo = typeof import('expo-video');
type ExpoAudio = typeof import('expo-audio');
type VideoPlayer = import('expo-video').VideoPlayer;

let expoVideoModule: ExpoVideo | null = null;
let expoVideoLoaded = false;
const loadExpoVideo = (): ExpoVideo | null => {
  if (Platform.OS === 'web') return null;
  if (expoVideoLoaded) return expoVideoModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoVideoModule = require('expo-video');
    expoVideoLoaded = true;
    console.log('[Radio] expo-video module loaded');
  } catch (e) {
    expoVideoLoaded = true;
    console.warn('[Radio] expo-video not available:', e);
  }
  return expoVideoModule;
};

let expoAudioModule: ExpoAudio | null = null;
let expoAudioLoaded = false;
const loadExpoAudio = (): ExpoAudio | null => {
  if (Platform.OS === 'web') return null;
  if (expoAudioLoaded) return expoAudioModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoAudioModule = require('expo-audio');
    expoAudioLoaded = true;
  } catch (e) {
    expoAudioLoaded = true;
    console.warn('[Radio] expo-audio not available:', e);
  }
  return expoAudioModule;
};

interface NowPlayingData {
  listeners: { total: number; unique: number; current: number };
  live: { is_live: boolean; streamer_name: string };
  now_playing: {
    song: { title: string; artist: string; album: string; art: string };
  };
  station: { name: string; description: string };
}

interface HlsLike {
  loadSource: (url: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  destroy: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

interface RadioRefs {
  mounted: boolean;
  player: VideoPlayer | null;
  subs: { remove: () => void }[];
  webAudio: HTMLAudioElement | null;
  webHls: HlsLike | null;
  desiredPlaying: boolean;
  connectTimer: ReturnType<typeof setTimeout> | null;
  watchdogTimer: ReturnType<typeof setInterval> | null;
  watchdogAttempts: number;
}

const HLS_CDN_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js';

const loadHlsJs = async (): Promise<unknown | null> => {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Hls?: unknown };
  if (w.Hls) return w.Hls;
  return new Promise((resolve) => {
    try {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${HLS_CDN_URL}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(w.Hls ?? null));
        existing.addEventListener('error', () => resolve(null));
        if (w.Hls) resolve(w.Hls);
        return;
      }
      const script = document.createElement('script');
      script.src = HLS_CDN_URL;
      script.async = true;
      script.onload = () => resolve((window as unknown as { Hls?: unknown }).Hls ?? null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    } catch {
      resolve(null);
    }
  });
};

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
    player: null,
    subs: [],
    webAudio: null,
    webHls: null,
    desiredPlaying: false,
    connectTimer: null,
    watchdogTimer: null,
    watchdogAttempts: 0,
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
    } catch (e) {
      console.warn('[Radio] Failed to fetch now playing:', e);
    }
  }, []);

  const startListenerPolling = useCallback(() => {
    if (listenerPollRef.current) return;
    fetchNowPlaying();
    listenerPollRef.current = setInterval(fetchNowPlaying, LISTENER_POLL_INTERVAL_MS);
  }, [fetchNowPlaying]);

  const stopListenerPolling = useCallback(() => {
    if (listenerPollRef.current) {
      clearInterval(listenerPollRef.current);
      listenerPollRef.current = null;
    }
  }, []);

  const buildMetadata = useCallback(() => {
    return {
      title: 'Freedom FM 106.5',
      artist: 'Live Radio',
      artwork: ARTWORK_URI,
    };
  }, []);

  const configureAudioMode = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const expoAudio = loadExpoAudio();
    if (!expoAudio?.setAudioModeAsync) return;
    try {
      await expoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        interruptionModeAndroid: 'doNotMix',
        allowsRecording: false,
      });
      console.log('[Radio] Audio mode configured for lock screen controls');
    } catch (e) {
      console.warn('[Radio] setAudioModeAsync failed:', e);
    }
  }, []);

  const playNativeRef = useRef<(() => Promise<void>) | null>(null);

  const stopResumeWatchdog = useCallback(() => {
    if (refs.current.watchdogTimer) {
      clearInterval(refs.current.watchdogTimer);
      refs.current.watchdogTimer = null;
    }
    refs.current.watchdogAttempts = 0;
  }, []);

  const startResumeWatchdog = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (refs.current.watchdogTimer) return;
    refs.current.watchdogAttempts = 0;
    console.log('[Radio] Watchdog started');
    refs.current.watchdogTimer = setInterval(() => {
      if (!refs.current.mounted) return;
      if (!refs.current.desiredPlaying) {
        stopResumeWatchdog();
        return;
      }
      let actuallyPlaying = false;
      try {
        actuallyPlaying = !!(refs.current.player as any)?.playing;
      } catch {}
      if (actuallyPlaying) {
        console.log('[Radio] Watchdog: playing again, stopping');
        stopResumeWatchdog();
        return;
      }
      refs.current.watchdogAttempts += 1;
      const attempt = refs.current.watchdogAttempts;
      console.log('[Radio] Watchdog attempt', attempt);
      if (attempt <= 2 && refs.current.player) {
        try {
          refs.current.player.play();
        } catch (e) {
          console.warn('[Radio] Watchdog soft play failed:', e);
        }
      } else if (attempt <= 10) {
        playNativeRef.current?.();
      } else {
        console.log('[Radio] Watchdog giving up after', attempt, 'attempts');
        stopResumeWatchdog();
      }
    }, 3000);
  }, [stopResumeWatchdog]);

  const clearConnectTimer = useCallback(() => {
    if (refs.current.connectTimer) {
      clearTimeout(refs.current.connectTimer);
      refs.current.connectTimer = null;
    }
  }, []);

  const disposePlayer = useCallback(() => {
    clearConnectTimer();
    for (const sub of refs.current.subs) {
      try {
        sub.remove();
      } catch {}
    }
    refs.current.subs = [];

    const player = refs.current.player;
    refs.current.player = null;
    if (player) {
      try {
        player.pause();
      } catch {}
      try {
        (player as unknown as { release?: () => void }).release?.();
      } catch {}
    }
  }, [clearConnectTimer]);

  const cleanupWebAudio = useCallback(() => {
    const hls = refs.current.webHls;
    if (hls) {
      refs.current.webHls = null;
      try {
        hls.destroy();
      } catch {}
    }
    const audio = refs.current.webAudio;
    if (!audio) return;
    refs.current.webAudio = null;
    try {
      audio.oncanplay = null;
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      audio.src = '';
      audio.load();
    } catch {}
  }, []);

  const updateMediaSessionWeb = useCallback(
    (playing: boolean) => {
      if (Platform.OS !== 'web') return;
      if (typeof navigator === 'undefined') return;
      const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
      if (!ms) return;
      try {
        const meta = buildMetadata();
        const MM = (globalThis as unknown as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
        if (MM) {
          ms.metadata = new MM({
            title: meta.title,
            artist: meta.artist,
            album: 'Freedom FM 106.5',
            artwork: meta.artwork
              ? [
                  { src: meta.artwork, sizes: '256x256', type: 'image/png' },
                  { src: meta.artwork, sizes: '512x512', type: 'image/png' },
                ]
              : [],
          });
        }
        ms.playbackState = playing ? 'playing' : 'paused';
      } catch (e) {
        console.warn('[Radio] MediaSession update failed:', e);
      }
    },
    [buildMetadata]
  );

  const playWeb = useCallback(async () => {
    cleanupWebAudio();
    setIsLoading(true);
    setError(null);

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = volume;
    refs.current.webAudio = audio;

    const isHls = STREAM_URL.includes('.m3u8');
    const canPlayNativeHls =
      isHls && typeof audio.canPlayType === 'function'
        ? audio.canPlayType('application/vnd.apple.mpegurl') !== ''
        : false;

    if (isHls && !canPlayNativeHls) {
      console.log('[Radio] Loading hls.js for web HLS playback');
      const HlsCtor = (await loadHlsJs()) as
        | (new (config?: unknown) => HlsLike & { static?: unknown })
        | null
        | undefined;
      const HlsStatic = HlsCtor as unknown as { isSupported?: () => boolean } | null;
      if (HlsCtor && HlsStatic?.isSupported?.()) {
        try {
          const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: false });
          refs.current.webHls = hls;
          hls.on('hlsError', () => {});
          hls.loadSource(STREAM_URL);
          hls.attachMedia(audio);
        } catch (e) {
          console.warn('[Radio] hls.js attach failed:', e);
          setIsPlaying(false);
          setIsLoading(false);
          setError('Unable to play stream. Please try again.');
          cleanupWebAudio();
          return;
        }
      } else {
        console.warn('[Radio] hls.js not available, falling back to direct src');
        audio.src = STREAM_URL;
      }
    } else {
      audio.src = STREAM_URL;
    }

    audio.onplaying = () => {
      if (!refs.current.mounted) return;
      setIsPlaying(true);
      setIsLoading(false);
      setError(null);
      updateMediaSessionWeb(true);
    };
    audio.onwaiting = () => {
      if (!refs.current.mounted) return;
      setIsLoading(true);
    };
    audio.onpause = () => {
      if (!refs.current.mounted) return;
      if (refs.current.desiredPlaying) return;
      setIsPlaying(false);
      updateMediaSessionWeb(false);
    };
    audio.onerror = () => {
      if (!refs.current.mounted) return;
      setIsPlaying(false);
      setIsLoading(false);
      setError('Unable to play stream. Please try again.');
      cleanupWebAudio();
    };

    try {
      await audio.play();
    } catch (e) {
      console.warn('[Radio] Web play failed:', e);
      if (refs.current.mounted) {
        setIsPlaying(false);
        setIsLoading(false);
        setError('Unable to play stream. Please try again.');
      }
      cleanupWebAudio();
    }
  }, [cleanupWebAudio, updateMediaSessionWeb, volume]);

  const playNative = useCallback(async () => {
    const expoVideo = loadExpoVideo();
    if (!expoVideo?.createVideoPlayer) {
      setError('Player module not available. Please restart the app.');
      setIsLoading(false);
      return;
    }

    await configureAudioMode();

    disposePlayer();

    setIsLoading(true);
    setError(null);

    const meta = buildMetadata();
    const source: any = {
      uri: STREAM_URL,
      metadata: {
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artwork,
      },
    };

    let player: VideoPlayer;
    try {
      player = expoVideo.createVideoPlayer(source);
    } catch (e) {
      console.error('[Radio] createVideoPlayer failed:', e);
      setError('Unable to start player. Please try again.');
      setIsLoading(false);
      return;
    }

    refs.current.player = player;

    // IMPORTANT: set sticky/background flags BEFORE play() so the foreground
    // service is started with the correct type and the notification persists.
    try {
      (player as any).staysActiveInBackground = true;
      (player as any).showNowPlayingNotification = true;
      (player as any).audioMixingMode = 'doNotMix';
      (player as any).allowsExternalPlayback = true;
      (player as any).volume = volume;
      (player as any).loop = false;
      // expo-video Android: keep service alive when app task is removed.
      (player as any).stayActiveInBackground = true;
    } catch (e) {
      console.warn('[Radio] Setting player flags failed:', e);
    }

    const sessionPlayer = player;

    try {
      const playingSub = (player as any).addListener?.('playingChange', (event: { isPlaying: boolean }) => {
        if (!refs.current.mounted) return;
        if (refs.current.player !== sessionPlayer) return;
        const playing = !!event?.isPlaying;
        console.log('[Radio] playingChange:', playing);
        setIsPlaying(playing);
        if (playing) {
          setIsLoading(false);
          setError(null);
          clearConnectTimer();
          stopResumeWatchdog();
        } else if (refs.current.desiredPlaying) {
          // Stream stopped while user wants playback — likely an interruption.
          // Kick the watchdog so we auto-recover.
          startResumeWatchdog();
        } else {
          setIsLoading(false);
        }
      });
      if (playingSub) refs.current.subs.push(playingSub);

      const statusSub = (player as any).addListener?.(
        'statusChange',
        (event: { status: string; error?: { message?: string } }) => {
          if (!refs.current.mounted) return;
          if (refs.current.player !== sessionPlayer) return;
          console.log('[Radio] statusChange:', event?.status, event?.error?.message);
          if (event?.status === 'readyToPlay') {
            setIsLoading(false);
            clearConnectTimer();
          } else if (event?.status === 'loading') {
            if (refs.current.desiredPlaying) setIsLoading(true);
          } else if (event?.status === 'error') {
            setIsPlaying(false);
            setIsLoading(false);
            setError(event?.error?.message ?? 'Stream error. Please try again.');
          }
        }
      );
      if (statusSub) refs.current.subs.push(statusSub);
    } catch (e) {
      console.warn('[Radio] addListener failed:', e);
    }

    clearConnectTimer();
    refs.current.connectTimer = setTimeout(() => {
      if (!refs.current.mounted) return;
      if (refs.current.player !== sessionPlayer) return;
      if (refs.current.desiredPlaying && !isPlaying) {
        console.warn('[Radio] Connect timeout');
        setIsLoading(false);
        setError('Stream connection timed out. Tap play to retry.');
      }
    }, STREAM_CONNECT_TIMEOUT_MS);

    try {
      player.play();
    } catch (e) {
      console.error('[Radio] player.play() failed:', e);
      setError('Unable to play stream. Please try again.');
      setIsLoading(false);
    }
  }, [buildMetadata, clearConnectTimer, configureAudioMode, disposePlayer, isPlaying, startResumeWatchdog, stopResumeWatchdog, volume]);

  useEffect(() => {
    playNativeRef.current = playNative;
  }, [playNative]);

  const play = useCallback(async () => {
    console.log('[Radio] Play requested');
    refs.current.desiredPlaying = true;
    if (Platform.OS === 'web') {
      await playWeb();
    } else {
      // If we already have a player (e.g. paused via notification/lockscreen),
      // just resume it so we don't tear down the foreground service.
      const existing = refs.current.player;
      if (existing) {
        try {
          setIsLoading(true);
          setError(null);
          existing.play();
          return;
        } catch (e) {
          console.warn('[Radio] resume failed, recreating player:', e);
        }
      }
      await playNative();
    }
  }, [playNative, playWeb]);

  const pause = useCallback(async () => {
    console.log('[Radio] Pause requested');
    refs.current.desiredPlaying = false;
    stopResumeWatchdog();

    if (Platform.OS === 'web') {
      cleanupWebAudio();
      updateMediaSessionWeb(false);
    } else {
      // Keep the player alive so the MediaSession / foreground notification
      // stays visible with a Play control. Only release on stop / unmount.
      try {
        refs.current.player?.pause();
      } catch (e) {
        console.warn('[Radio] player.pause() failed:', e);
      }
    }

    if (refs.current.mounted) {
      setIsPlaying(false);
      setIsLoading(false);
      setError(null);
    }
  }, [cleanupWebAudio, stopResumeWatchdog, updateMediaSessionWeb]);

  const stop = useCallback(async () => {
    console.log('[Radio] Stop requested');
    refs.current.desiredPlaying = false;
    stopResumeWatchdog();

    if (Platform.OS === 'web') {
      cleanupWebAudio();
      updateMediaSessionWeb(false);
    } else {
      disposePlayer();
    }

    if (refs.current.mounted) {
      setIsPlaying(false);
      setIsLoading(false);
      setError(null);
    }
  }, [cleanupWebAudio, disposePlayer, stopResumeWatchdog, updateMediaSessionWeb]);

  const forceReset = useCallback(async () => {
    console.log('[Radio] Force reset');
    refs.current.desiredPlaying = false;
    stopResumeWatchdog();
    if (Platform.OS === 'web') {
      cleanupWebAudio();
    } else {
      disposePlayer();
    }
    if (refs.current.mounted) {
      setIsPlaying(false);
      setIsLoading(false);
      setError(null);
    }
  }, [cleanupWebAudio, disposePlayer]);

  const toggle = useCallback(async () => {
    if (isPlaying || isLoading) {
      await pause();
    } else {
      await play();
    }
  }, [isLoading, isPlaying, pause, play]);

  const changeVolume = useCallback(async (newVolume: number) => {
    if (refs.current.mounted) setVolume(newVolume);
    if (Platform.OS === 'web') {
      if (refs.current.webAudio) refs.current.webAudio.volume = newVolume;
      return;
    }
    try {
      if (refs.current.player) {
        (refs.current.player as any).volume = newVolume;
      }
    } catch (e) {
      console.warn('[Radio] setVolume failed:', e);
    }
  }, []);

  // Configure native audio session early so lock screen controls work
  useEffect(() => {
    configureAudioMode();
  }, [configureAudioMode]);

  // Keep web MediaSession metadata in sync with playback state.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (refs.current.webAudio) updateMediaSessionWeb(isPlaying);
  }, [isPlaying, updateMediaSessionWeb]);

  // Set up MediaSession action handlers on web for lock screen controls
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined') return;
    const ms = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
    if (!ms) return;
    try {
      ms.setActionHandler('play', () => {
        play();
      });
      ms.setActionHandler('pause', () => {
        pause();
      });
      ms.setActionHandler('stop', () => {
        stop();
      });
    } catch (e) {
      console.warn('[Radio] MediaSession handlers failed:', e);
    }
    return () => {
      try {
        ms.setActionHandler('play', null);
        ms.setActionHandler('pause', null);
        ms.setActionHandler('stop', null);
      } catch {}
    };
  }, [pause, play, stop]);

  // Listener-count polling lifecycle
  useEffect(() => {
    refs.current.mounted = true;
    startListenerPolling();
    return () => {
      refs.current.mounted = false;
      stopListenerPolling();
    };
  }, [startListenerPolling, stopListenerPolling]);

  // Cleanup on unmount.
  // IMPORTANT: do NOT dispose the native player if the user still wants
  // playback. The foreground media service must remain sticky across
  // provider remounts (hot reload, navigation churn, brief task trims) so
  // audio keeps playing and the lock-screen notification doesn't disappear.
  useEffect(() => {
    return () => {
      stopResumeWatchdog();
      if (Platform.OS === 'web') {
        cleanupWebAudio();
        return;
      }
      if (refs.current.desiredPlaying) {
        console.log('[Radio] Provider unmount with desiredPlaying=true — keeping service alive');
        return;
      }
      disposePlayer();
    };
  }, [cleanupWebAudio, disposePlayer, stopResumeWatchdog]);

  // Reconnect on returning to foreground if user wanted playback.
  // This is what makes the app behave like TuneIn: if another app interrupted
  // our audio (e.g. by playing a video), we recover the stream automatically
  // when the user comes back to Freedom FM.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onChange = async (s: AppStateStatus) => {
      console.log('[Radio] AppState change:', s, 'desired:', refs.current.desiredPlaying);
      if (s !== 'active') return;
      if (!refs.current.desiredPlaying) return;

      // Re-assert audio session (some OEMs drop it after interruption)
      await configureAudioMode();

      let stillPlaying = false;
      try {
        stillPlaying = !!(refs.current.player as any)?.playing;
      } catch {}
      if (stillPlaying) {
        console.log('[Radio] Foreground: already playing');
        return;
      }

      // Auto-resume on refocus. The previous session was very likely killed
      // by the interrupting app, so we do a full recreate rather than a soft
      // play() on a stale player (which tends to silently fail).
      console.log('[Radio] Foreground: auto-resuming playback');
      setIsLoading(true);
      setError(null);
      playNative();

      // Safety net in case the recreate also gets blocked.
      startResumeWatchdog();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [configureAudioMode, playNative, startResumeWatchdog]);

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
    [
      changeVolume,
      error,
      fetchNowPlaying,
      forceReset,
      isLoading,
      isPlaying,
      listenerCount,
      nowPlaying,
      pause,
      play,
      stop,
      toggle,
      volume,
    ]
  );
});
