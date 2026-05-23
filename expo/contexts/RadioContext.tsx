import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AppState, AppStateStatus, Platform } from 'react-native';

const ARTWORK_URI: string =
  'https://r2-pub.rork.com/generated-images/1d85f2e0-ed62-4f47-9f88-65be8a368811.png';

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
  /** Timestamp (ms) of the last successful playingChange:true. */
  lastPlayingAtMs: number;
  /** True when we suspect another app currently owns the audio focus. */
  interruptedByOtherApp: boolean;
  /** True when polite-mode silent-keepalive (volume 0) is active. */
  silentKeepalive: boolean;
  /** Restore volume when leaving polite mode. */
  restoreVolume: number;
  /** Last reported player status from statusChange. */
  lastStatus: string;
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
    lastPlayingAtMs: 0,
    interruptedByOtherApp: false,
    silentKeepalive: false,
    restoreVolume: 1.0,
    lastStatus: '',
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
      // iOS: must be primary playback (NOT mixWithOthers) so the
      // Now Playing info center / lock-screen controls appear. iOS
      // suppresses Now Playing metadata when the session is mixed.
      // Android: keep mixWithOthers so YouTube/Facebook/Spotify keep
      // playing alongside the radio. The Android foreground media
      // service still shows the notification with controls.
      await expoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: Platform.OS === 'ios' ? 'duckOthers' : 'mixWithOthers',
        interruptionModeAndroid: 'mixWithOthers',
        shouldRouteThroughEarpiece: false,
        allowsRecording: false,
      });
      console.log('[Radio] Audio mode configured (iOS=primary playback for lock-screen, Android=mixed)');
    } catch (e) {
      console.warn('[Radio] setAudioModeAsync failed:', e);
    }
  }, []);

  const playNativeRef = useRef<(() => Promise<void>) | null>(null);

  const stopResumeWatchdog = useCallback(() => {
    if (refs.current.watchdogTimer) {
      clearTimeout(refs.current.watchdogTimer);
      refs.current.watchdogTimer = null;
    }
    refs.current.watchdogAttempts = 0;
  }, []);

  const runWatchdogTickRef = useRef<(() => void) | null>(null);

  const scheduleNextWatchdogTick = useCallback((delayMs: number) => {
    if (refs.current.watchdogTimer) {
      clearTimeout(refs.current.watchdogTimer);
      refs.current.watchdogTimer = null;
    }
    refs.current.watchdogTimer = setTimeout(() => {
      refs.current.watchdogTimer = null;
      runWatchdogTickRef.current?.();
    }, delayMs);
  }, []);

  const runWatchdogTick = useCallback(() => {
    if (!refs.current.desiredPlaying) {
      stopResumeWatchdog();
      return;
    }

    // Auto-resume strategy:
    // The user wants playback. A transient stream drop or OS pause may have
    // stopped the player. Keep retrying softly with backoff so the radio
    // resumes after the external video/audio stops without taking focus away
    // from YouTube/Facebook while they are playing.
    let actuallyPlaying = false;
    try {
      actuallyPlaying = !!(refs.current.player as any)?.playing;
    } catch {}

    if (actuallyPlaying) {
      const stableMs = Date.now() - refs.current.lastPlayingAtMs;
      if (stableMs > 5000) {
        console.log('[Radio] Watchdog: playback stable, stopping');
        stopResumeWatchdog();
        return;
      }
    }

    refs.current.watchdogAttempts += 1;
    const attempt = refs.current.watchdogAttempts;
    console.log('[Radio] Watchdog attempt', attempt);

    // Use only soft play() retries here. Recreating the player tears down
    // lock-screen controls and can re-negotiate audio focus, which is what
    // makes YouTube/Facebook pause on some devices. Hard recreate remains
    // limited to real player errors below.
    if (refs.current.player) {
      try {
        refs.current.player.play();
      } catch (e) {
        console.warn('[Radio] Watchdog soft play failed:', e);
      }
    }

    // Backoff schedule: 2s, 2s, 4s, 4s, 4s, 8s, 8s, 8s, 15s, then 15s forever.
    // Keeps retrying until the stream is playing again.
    let nextDelay: number;
    if (attempt < 3) nextDelay = 2000;
    else if (attempt < 6) nextDelay = 4000;
    else if (attempt < 9) nextDelay = 8000;
    else nextDelay = 15000;
    scheduleNextWatchdogTick(nextDelay);
  }, [scheduleNextWatchdogTick, stopResumeWatchdog]);

  useEffect(() => {
    runWatchdogTickRef.current = runWatchdogTick;
  }, [runWatchdogTick]);

  const startResumeWatchdog = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (refs.current.watchdogTimer) return;
    if (refs.current.watchdogAttempts > 0) {
      // Already running through a tick; do nothing.
      return;
    }
    console.log('[Radio] Watchdog started');
    // Fire the first tick IMMEDIATELY — don't wait for the interval. This
    // matters when the app is backgrounded and timers may be throttled.
    runWatchdogTickRef.current?.();
  }, []);

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
      // iOS: 'auto' makes expo-video own the Now Playing session so
      // the lock-screen / Control Center controls appear with title,
      // artist and artwork. 'mixWithOthers' would hide them entirely.
      // Android: mixed mode lets YouTube/Spotify keep playing.
      (player as any).audioMixingMode = Platform.OS === 'ios' ? 'auto' : 'mixWithOthers';
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
          const wasInterrupted = refs.current.silentKeepalive || refs.current.interruptedByOtherApp;
          const idleMs = refs.current.lastPlayingAtMs ? Date.now() - refs.current.lastPlayingAtMs : 0;
          refs.current.lastPlayingAtMs = Date.now();
          setIsLoading(false);
          setError(null);
          clearConnectTimer();
          if (wasInterrupted) {
            console.log('[Radio] Audio focus restored — resuming normally');
            refs.current.silentKeepalive = false;
            refs.current.interruptedByOtherApp = false;
            try {
              (sessionPlayer as any).volume = refs.current.restoreVolume || volume || 1.0;
            } catch {}
            // Keep mixed-audio behavior after recovery so external videos
            // continue instead of being paused by the radio.
            configureAudioMode();
            if (idleMs > 30000) {
              console.log('[Radio] Stream recovered after', idleMs, 'ms idle');
            }
          }
          stopResumeWatchdog();
        } else if (refs.current.desiredPlaying) {
          // Distinguish a user-initiated pause (lock screen / Control Center
          // / notification) from a network blip. When the user taps pause on
          // the lock screen, expo-video fires playingChange:false but the
          // player status remains 'readyToPlay' (the source is still loaded,
          // it's just paused). Network blips come with status 'loading' or
          // 'error'. If we see a clean pause from a ready stream, honor it.
          const status = refs.current.lastStatus;
          if (status === 'readyToPlay') {
            console.log('[Radio] Pause from lock-screen / notification detected — honoring');
            refs.current.desiredPlaying = false;
            stopResumeWatchdog();
            setIsLoading(false);
            setError(null);
            return;
          }
          // Stream stopped while user wants playback and status isn't ready —
          // treat as network blip and reconnect.
          console.log('[Radio] Playback stopped while desired (status:', status, ') — reconnecting');
          refs.current.watchdogAttempts = 0;
          if (refs.current.watchdogTimer) {
            clearTimeout(refs.current.watchdogTimer);
            refs.current.watchdogTimer = null;
          }
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
          refs.current.lastStatus = event?.status ?? '';
          if (event?.status === 'readyToPlay') {
            setIsLoading(false);
            clearConnectTimer();
          } else if (event?.status === 'loading') {
            if (refs.current.desiredPlaying) setIsLoading(true);
          } else if (event?.status === 'error') {
            setIsPlaying(false);
            setIsLoading(false);
            setError(event?.error?.message ?? 'Stream error. Please try again.');
            // On a real error AND the user still wants playback, do a full
            // recreate — but only here, never from the watchdog. This is the
            // single recreate path during background recovery, so the
            // notification only rebuilds when absolutely necessary.
            if (refs.current.desiredPlaying) {
              console.log('[Radio] Hard error while desired — recreating once');
              try {
                playNativeRef.current?.();
              } catch (e) {
                console.warn('[Radio] Recreate after error failed:', e);
              }
            }
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
  }, [buildMetadata, clearConnectTimer, configureAudioMode, disposePlayer, isPlaying, scheduleNextWatchdogTick, startResumeWatchdog, stopResumeWatchdog, volume]);

  useEffect(() => {
    playNativeRef.current = playNative;
  }, [playNative]);

  const play = useCallback(async () => {
    console.log('[Radio] Play requested');
    refs.current.desiredPlaying = true;
    // User explicitly asked to play — reset polite mode so we make a real
    // attempt to take audio focus.
    refs.current.interruptedByOtherApp = false;
    refs.current.silentKeepalive = false;
    refs.current.watchdogAttempts = 0;
    refs.current.restoreVolume = volume;
    // Make sure we're audible.
    try {
      if (refs.current.player) {
        (refs.current.player as any).volume = volume;
      }
    } catch {}
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
    refs.current.interruptedByOtherApp = false;
    refs.current.silentKeepalive = false;
    stopResumeWatchdog();
    // Restore audible volume in case we paused while silent-keepalive was on.
    try {
      if (refs.current.player) {
        (refs.current.player as any).volume = refs.current.restoreVolume || volume;
      }
    } catch {}

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
    refs.current.interruptedByOtherApp = false;
    refs.current.silentKeepalive = false;
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
      // Only mark unmounted if the user isn't still expecting playback.
      // Keeping `mounted = true` lets the watchdog and player keep operating
      // across provider remounts and while the app is backgrounded. The
      // `mounted` flag is only used to guard React state updates, which are
      // harmless to attempt after unmount in React 18+.
      if (!refs.current.desiredPlaying) {
        refs.current.mounted = false;
      }
      stopListenerPolling();
    };
  }, [startListenerPolling, stopListenerPolling]);

  // Cleanup on unmount.
  // IMPORTANT: do NOT dispose the native player or stop the resume watchdog
  // if the user still wants playback. The foreground media service must
  // remain sticky across provider remounts (hot reload, navigation churn,
  // brief task trims) so audio keeps playing and the lock-screen
  // notification doesn't disappear. The watchdog must also keep running so
  // that when an interrupting app (YouTube, call, etc.) stops, we resume
  // automatically even if the user hasn't returned to Freedom FM yet.
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        stopResumeWatchdog();
        cleanupWebAudio();
        return;
      }
      if (refs.current.desiredPlaying) {
        console.log('[Radio] Provider unmount with desiredPlaying=true — keeping service & watchdog alive');
        return;
      }
      stopResumeWatchdog();
      disposePlayer();
    };
  }, [cleanupWebAudio, disposePlayer, stopResumeWatchdog]);

  // Reconnect on returning to foreground if user wanted playback.
  // Keep mixed-audio mode so returning to Freedom FM does not pause
  // YouTube/Facebook/Spotify if that media is still playing.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onChange = async (s: AppStateStatus) => {
      console.log('[Radio] AppState change:', s, 'desired:', refs.current.desiredPlaying);

      // Going to background is normal — do NOT start the watchdog here.
      // Starting it would call player.play(), which on Android re-requests
      // audio focus and stops whatever other app the user is about to use.
      // The watchdog is only for true network blips (started from
      // playingChange:false in the non-interrupted case).
      if (s === 'background' || s === 'inactive') return;

      if (s !== 'active') return;
      if (!refs.current.desiredPlaying) return;

      // Re-assert the mixed audio session; some OEMs drop it after backgrounding.
      await configureAudioMode();

      let stillPlaying = false;
      try {
        stillPlaying = !!(refs.current.player as any)?.playing;
      } catch {}
      if (stillPlaying) {
        console.log('[Radio] Foreground: already playing');
        return;
      }

      refs.current.interruptedByOtherApp = false;
      refs.current.silentKeepalive = false;
      refs.current.watchdogAttempts = 0;

      // First try a soft resume so we do not tear down the lock-screen service
      // or cause another app's video/audio to pause. Only hard errors recreate.
      console.log('[Radio] Foreground: softly resuming playback');
      setIsLoading(true);
      setError(null);
      try {
        refs.current.player?.play();
      } catch (e) {
        console.warn('[Radio] Foreground soft resume failed:', e);
      }

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
