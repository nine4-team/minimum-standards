import { useState, useCallback } from 'react';
// TEMP STUB for Suggestor flow (introduced in bb65b3c).
// `@react-native-firebase/functions` is declared in package.json but install fails:
// v23.8+ requires Firebase/Auth=12.10.0 which in turn requires a higher iOS
// deployment target than this project currently sets. Fix is to bump the rest of
// the @react-native-firebase/* packages to 23.8.x and raise the iOS min target —
// tracked separately. Until then this stub makes the Suggestor call no-op and
// surface a friendly error if invoked.
const functions: any = () => ({
  httpsCallable: () => async () => {
    throw Object.assign(new Error('Suggestor disabled: functions package missing'), {
      code: 'functions/unavailable',
    });
  },
});

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
