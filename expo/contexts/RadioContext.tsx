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
  /** Timestamp (ms) of the last successful playingChange:true. */
  lastPlayingAtMs: number;
  /** True when we suspect another app currently owns the audio focus. */
  interruptedByOtherApp: boolean;
  /** True when polite-mode silent-keepalive (volume 0) is active. */
  silentKeepalive: boolean;
  /** Restore volume when leaving polite mode. */
  restoreVolume: number;
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

  const configureAudioMode = useCallback(async (mode: 'duckOthers' | 'doNotMix' = 'duckOthers') => {
    if (Platform.OS === 'web') return;
    const expoAudio = loadExpoAudio();
    if (!expoAudio?.setAudioModeAsync) return;
    try {
      // 'duckOthers' (default): we're willing to share the session. When
      // another app takes focus, the OS pauses us gracefully and (in theory)
      // sends AUDIOFOCUS_GAIN when that app finishes. In practice, Expo Go
      // backgrounded JS doesn't reliably get the gain event, so polite mode
      // also runs a slow silent probe as a fallback.
      //
      // 'doNotMix' (used during interruption): tells Android we're a high-
      // priority media app and want to be notified when focus returns. This
      // improves the chance that AUDIOFOCUS_GAIN actually delivers.
      await expoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: mode,
        interruptionModeAndroid: mode,
        shouldRouteThroughEarpiece: false,
        allowsRecording: false,
      });
      console.log('[Radio] Audio mode configured (' + mode + ')');
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

    // POLITE MODE: another app owns focus. We can't reliably get
    // AUDIOFOCUS_GAIN delivered to backgrounded JS in Expo Go, so we do a
    // slow silent probe every 20s as a fallback. Each probe:
    //   - sets volume to 0 (so even if we grab focus, no audio plays)
    //   - calls player.play() (Android decides whether to give us focus)
    //   - waits 1.2s, then checks if it stuck
    //     * stuck: other app finished -> restore volume, exit polite mode
    //     * not stuck: other app still owns focus -> pause, wait 20s
    // The blip is ~1s of inaudible probe to YouTube every 20s.
    if (refs.current.interruptedByOtherApp) {
      const player = refs.current.player;
      if (!player) {
        console.log('[Radio] Polite watchdog: no player, recreating');
        try { playNativeRef.current?.(); } catch {}
        scheduleNextWatchdogTick(20000);
        return;
      }
      console.log('[Radio] Polite probe: silent play() to check if focus is available');
      try {
        refs.current.restoreVolume = refs.current.restoreVolume || volume || 1.0;
        (player as any).volume = 0;
        player.play();
      } catch (e) {
        console.warn('[Radio] Polite probe play failed:', e);
      }
      // Check 1.5s later whether we actually kept focus.
      setTimeout(() => {
        if (!refs.current.desiredPlaying) return;
        if (!refs.current.interruptedByOtherApp) return; // already recovered
        let stillPlaying = false;
        try { stillPlaying = !!(refs.current.player as any)?.playing; } catch {}
        if (stillPlaying) {
          console.log('[Radio] Polite probe succeeded — other app released focus, restoring volume');
          refs.current.interruptedByOtherApp = false;
          refs.current.silentKeepalive = false;
          try {
            (refs.current.player as any).volume = refs.current.restoreVolume || volume || 1.0;
          } catch {}
          // Re-arm normal duckOthers mode for next interruption.
          configureAudioMode('duckOthers');
          stopResumeWatchdog();
        } else {
          // Pause silently so we don't keep an inaudible session running.
          try { refs.current.player?.pause(); } catch {}
        }
      }, 1500);
      scheduleNextWatchdogTick(20000);
      return;
    }

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

    // Only used when there's no foreign app interruption (e.g. a network
    // blip). Try soft play first, then recreate.
    if (attempt <= 2 && refs.current.player) {
      try {
        refs.current.player.play();
      } catch (e) {
        console.warn('[Radio] Watchdog soft play failed:', e);
      }
    } else if (attempt <= 5) {
      try {
        playNativeRef.current?.();
      } catch (e) {
        console.warn('[Radio] Watchdog recreate failed:', e);
      }
    } else {
      // Give up — likely an interruption we missed flagging. Stop probing.
      console.log('[Radio] Watchdog: giving up after attempt', attempt);
      stopResumeWatchdog();
      return;
    }

    const nextDelay = attempt < 3 ? 2000 : 4000;
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
      // 'auto' lets the OS arbitrate focus — when another app plays we get
      // paused, and AUDIOFOCUS_GAIN auto-resumes us. This is the key to
      // "wait for the user to stop the other app, then play again" without
      // the JS layer having to fight for focus.
      (player as any).audioMixingMode = 'auto';
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
            // Restore duckOthers for future cooperative behavior.
            configureAudioMode('duckOthers');
            // If the HLS socket was idle for a long time, the stream is
            // likely stale (server may have closed the connection). Do a
            // full recreate now that we have focus, so we don't get a 404
            // mid-resume. This is the ONLY recreate path during recovery.
            if (idleMs > 30000) {
              console.log('[Radio] Stream was idle for', idleMs, 'ms — refreshing source on resume');
              try {
                playNativeRef.current?.();
              } catch {}
            }
          }
          stopResumeWatchdog();
        } else if (refs.current.desiredPlaying) {
          // Stream stopped while user wants playback.
          // Detect ping-pong: if we were playing for less than 3 seconds, an
          // external app (YouTube, a call) took audio focus. Mark interrupted
          // and STOP TRYING TO PLAY — the OS will resume us on
          // AUDIOFOCUS_GAIN via expo-video's 'auto' mixing mode. We must not
          // call play() while interrupted; that would stop the other app.
          const playedForMs = refs.current.lastPlayingAtMs
            ? Date.now() - refs.current.lastPlayingAtMs
            : Number.MAX_SAFE_INTEGER;
          if (playedForMs < 30000) {
            // Treat almost any "stopped while desired" in the background as
            // an external interruption. Better safe than starting a probe
            // loop that fights another app. If it was truly a network blip,
            // AUDIOFOCUS_GAIN will still hand focus back when nothing else
            // is playing and expo-video will resume on its own.
            if (!refs.current.interruptedByOtherApp) {
              console.log('[Radio] Playback stopped while desired — entering polite mode (slow silent probe every 20s)');
              // Switch to doNotMix so Android treats us as a media app that
              // wants AUDIOFOCUS_GAIN notifications.
              configureAudioMode('doNotMix');
            }
            refs.current.interruptedByOtherApp = true;
            // Keep player object alive so the OS can resume it, but do NOT
            // call play() and do NOT touch volume. The OS will hand us
            // focus back automatically when the other app releases it.
          }
          refs.current.watchdogAttempts = 0;
          if (refs.current.watchdogTimer) {
            clearTimeout(refs.current.watchdogTimer);
            refs.current.watchdogTimer = null;
          }
          // Start the watchdog regardless — in polite mode it will run the
          // slow silent-probe loop; in non-polite mode it does the fast soft
          // play / recreate path for network blips.
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
  // This is what makes the app behave like TuneIn: if another app interrupted
  // our audio (e.g. by playing a video), we recover the stream automatically
  // when the user comes back to Freedom FM.
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

      // User came back — reset polite mode so we make a real attempt to take
      // audio focus again. By the time they're back in our app, the other
      // app is almost certainly paused/closed.
      refs.current.interruptedByOtherApp = false;
      refs.current.silentKeepalive = false;
      refs.current.watchdogAttempts = 0;

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
