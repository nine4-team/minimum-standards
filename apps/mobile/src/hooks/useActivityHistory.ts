import { useEffect, useState } from 'react';
import { ActivityHistoryDoc } from '@minimum-standards/shared-model';
import { useAuthStore } from '../stores/authStore';
import { listenActivityHistoryForStandard } from '../utils/activityHistoryFirestore';

export type ActivityHistoryRow = ActivityHistoryDoc;

export interface UseActivityHistoryResult {
  rows: ActivityHistoryRow[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch persisted activityHistory rows for a given standardId.
 * Queries activityHistory where standardId == X orderBy referenceTimestampMs desc.
 */
export function useActivityHistory(standardId: string | null): UseActivityHistoryResult {
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const userId = useAuthStore((state) => state.authenticatedUid);

  useEffect(() => {
    if (!userId || !standardId) {
      setLoading(false);
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenActivityHistoryForStandard({
      userId,
      standardId,
      onNext: (docs: ActivityHistoryDoc[]) => {
        setRows(docs);
        setLoading(false);
      },
      onError: (err: Error) => {
        setError(err);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [userId, standardId]);

  return {
    rows,
    loading,
    error,
  };
}
