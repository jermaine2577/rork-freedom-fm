import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const TERMS_ACCEPTED_KEY = '@freedom_fm_terms_accepted';

let cachedTermsStatus: boolean | null = null;

export const [TermsProvider, useTerms] = createContextHook(() => {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(cachedTermsStatus ?? false);
  const [isLoading, setIsLoading] = useState<boolean>(cachedTermsStatus === null);

  useEffect(() => {
    if (cachedTermsStatus !== null) {
      setIsLoading(false);
      return;
    }
    
    const loadTerms = async () => {
      try {
        const accepted = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        cachedTermsStatus = accepted === 'true';
        setHasAcceptedTerms(cachedTermsStatus);
      } catch {
        cachedTermsStatus = false;
        setHasAcceptedTerms(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTerms();
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
