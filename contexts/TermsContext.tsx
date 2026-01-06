import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const TERMS_ACCEPTED_KEY = '@freedom_fm_terms_accepted';

export const [TermsProvider, useTerms] = createContextHook(() => {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadTermsStatus = async () => {
      try {
        const accepted = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        if (mounted) {
          setHasAcceptedTerms(accepted === 'true');
        }
      } catch (error) {
        console.error('Failed to load terms status:', error);
        if (mounted) {
          setHasAcceptedTerms(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadTermsStatus();
    
    return () => {
      mounted = false;
    };
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
