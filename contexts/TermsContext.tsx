import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

async function getStorage(): Promise<StorageLike> {
  if (Platform.OS === 'web') {
    return {
      getItem: async (key: string) => {
        try {
          return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        } catch (e) {
          console.warn('[Terms] localStorage.getItem failed', e);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        } catch (e) {
          console.warn('[Terms] localStorage.setItem failed', e);
        }
      },
      removeItem: async (key: string) => {
        try {
          if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        } catch (e) {
          console.warn('[Terms] localStorage.removeItem failed', e);
        }
      },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default as StorageLike;
    return AsyncStorage;
  } catch (e) {
    console.warn('[Terms] AsyncStorage module not available', e);
    return {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
  }
}

const TERMS_ACCEPTED_KEY = '@freedom_fm_terms_accepted';

export const [TermsProvider, useTerms] = createContextHook(() => {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const loadTerms = async () => {
      const startedAt = Date.now();
      console.log('[Terms] Loading terms...', { platform: Platform.OS });

      try {
        const storage = await getStorage();

        if (Platform.OS === 'web') {
          const accepted = await storage.getItem(TERMS_ACCEPTED_KEY);
          if (mounted) setHasAcceptedTerms(accepted === 'true');
          return;
        }

        const timeoutMs = 2000;
        const accepted = await Promise.race<string | null>([
          storage.getItem(TERMS_ACCEPTED_KEY),
          new Promise<string | null>((resolve) => {
            setTimeout(() => {
              console.warn('[Terms] getItem timeout, continuing without stored terms');
              resolve(null);
            }, timeoutMs);
          }),
        ]);

        if (mounted) {
          setHasAcceptedTerms(accepted === 'true');
        }
      } catch (error) {
        console.log('[Terms] Failed to load terms:', error);
        if (mounted) setHasAcceptedTerms(false);
      } finally {
        const elapsedMs = Date.now() - startedAt;
        console.log('[Terms] Terms load complete', { elapsedMs });
        if (mounted) setIsLoading(false);
      }
    };

    loadTerms();

    return () => {
      mounted = false;
    };
  }, []);

  const acceptTerms = useCallback(async () => {
    try {
      const storage = await getStorage();
      await storage.setItem(TERMS_ACCEPTED_KEY, 'true');
      setHasAcceptedTerms(true);
    } catch (error) {
      console.error('[Terms] Failed to save terms acceptance:', error);
    }
  }, []);

  const resetTerms = useCallback(async () => {
    try {
      const storage = await getStorage();
      await storage.removeItem(TERMS_ACCEPTED_KEY);
      setHasAcceptedTerms(false);
    } catch (error) {
      console.error('[Terms] Failed to reset terms:', error);
    }
  }, []);

  return {
    hasAcceptedTerms,
    isLoading,
    acceptTerms,
    resetTerms,
  };
});
