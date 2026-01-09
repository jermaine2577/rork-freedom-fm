import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const TERMS_ACCEPTED_KEY = '@freedom_fm_terms_accepted';

export const [TermsProvider, useTerms] = createContextHook(() => {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    
    const loadTerms = async () => {
      try {
        const accepted = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        if (mounted) {
          setHasAcceptedTerms(accepted === 'true');
        }
      } catch (error) {
        console.log('[Terms] Failed to load terms:', error);
        if (mounted) {
          setHasAcceptedTerms(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadTerms();
    
    return () => {
      mounted = false;
    };
  }, []);

  const acceptTerms = async () => {
    try {
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
      setHasAcceptedTerms(true);
    } catch (error) {
      console.error('[Terms] Failed to save terms acceptance:', error);
    }
  };

  const resetTerms = async () => {
    try {
      await AsyncStorage.removeItem(TERMS_ACCEPTED_KEY);
      setHasAcceptedTerms(false);
    } catch (error) {
      console.error('[Terms] Failed to reset terms:', error);
    }
  };

  return {
    hasAcceptedTerms,
    isLoading,
    acceptTerms,
    resetTerms,
  };
});
