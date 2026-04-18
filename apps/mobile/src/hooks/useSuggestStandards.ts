import { useState, useCallback } from 'react';
import { callFunction } from '../services/cloudFunctions';

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
      const result = await callFunction<SuggestResult>('suggestStandards', { userInput });
      return result;
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
