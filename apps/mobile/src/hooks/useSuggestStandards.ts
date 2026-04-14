import { useState, useCallback } from 'react';
import functions from '@react-native-firebase/functions';

export interface StandardSuggestion {
  name: string;
  units: string[];
}

interface SuggestResult {
  suggestions: StandardSuggestion[];
}

export function useSuggestStandards() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(async (userInput: string): Promise<SuggestResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const callable = functions().httpsCallable('suggestStandards');
      const result = await callable({ userInput });
      return result.data as SuggestResult;
    } catch (err: any) {
      const code = err?.code;
      if (code === 'functions/resource-exhausted') {
        setError('Daily limit reached. Try again tomorrow.');
      } else if (code === 'functions/invalid-argument') {
        setError('Please enter a description.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { suggest, loading, error };
}
