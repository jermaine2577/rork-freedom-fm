import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const TERMS_ACCEPTED_KEY = '@freedom_fm_terms_accepted';

let cachedTermsStatus: boolean | null = null;

export const [TermsProvider, useTerms] = createContextHook(() => {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => {
    return cachedTermsStatus ?? true;
  });
  const [isLoading, setIsLoading] = useState<boolean>(cachedTermsStatus === null);

  useEffect(() => {
    if (cachedTermsStatus !== null) {
      setIsLoading(false);
      return;
    }
    
    let mounted = true;
    AsyncStorage.getItem(TERMS_ACCEPTED_KEY).then((accepted) => {
      cachedTermsStatus = accepted === 'true';
      if (mounted) {
        setHasAcceptedTerms(cachedTermsStatus);
        setIsLoading(false);
      }
    }).catch(() => {
      cachedTermsStatus = false;
      if (mounted) {
        setHasAcceptedTerms(false);
        setIsLoading(false);
      }
    });
    
    return () => { mounted = false; };
  }, []);

  const acceptTerms = async () => {
    try {
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
      setHasAcceptedTerms(true);
    } catch (error) {
      console.error('Failed to save terms acceptance:', error);
    }
  };

  const resetTerms = async () => {
    try {
      await AsyncStorage.removeItem(TERMS_ACCEPTED_KEY);
      setHasAcceptedTerms(false);
    } catch (error) {
      console.error('Failed to reset terms:', error);
    }
  };

  return {
    hasAcceptedTerms,
    isLoading,
    acceptTerms,
    resetTerms,
  };
});
