import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FirebaseFirestoreTypes,
  collection,
  doc,
  query,
  where,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { useAuthStore } from '../stores/authStore';
import { useStandards } from './useStandards';
import {
  computeStandardHistory,
  PeriodHistoryEntry,
  PeriodHistoryLogSlice,
} from '../utils/standardHistory';

export interface UseStandardHistoryResult {
  history: PeriodHistoryEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook to fetch and compute period history for a standard.
 * Subscribes to logs for the standard and computes period history using deterministic period windows.
 *
 * @param standardId - The ID of the standard to fetch history for
 * @param timezone - IANA timezone identifier (optional, defaults to system timezone)
 * @returns History array, loading state, error state, and refresh function
 */
export function useStandardHistory(
  standardId: string | null,
  timezone?: string
): UseStandardHistoryResult {
  const { standards } = useStandards();
  const [logs, setLogs] = useState<PeriodHistoryLogSlice[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const userId = useAuthStore((state) => state.authenticatedUid);
  const resolvedTimezone =
    timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const standard = useMemo(
    () => standards.find((s) => s.id === standardId) ?? null,
    [standards, standardId]
  );

  useEffect(() => {
    if (!userId || !standardId || !standard) {
      setLogsLoading(false);
      setLogs([]);
      return;
    }

    setLogsLoading(true);
    setLogsError(null);

    // Query all logs for this standard (no time filter, we'll compute periods)
    // We filter by standardId and exclude deleted logs
    const logsQuery = query(
      collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
      where('standardId', '==', standardId)
    );

    const unsubscribe = logsQuery.onSnapshot(
      (snapshot) => {
        const nextLogs: PeriodHistoryLogSlice[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            standardId?: string;
            value?: number;
            occurredAt?: FirebaseFirestoreTypes.Timestamp;
            deletedAt?: FirebaseFirestoreTypes.Timestamp | null;
            note?: string | null;
          };

          if (!data || !data.standardId || typeof data.value !== 'number') {
            return;
          }

          // Exclude soft-deleted logs
          if (data.deletedAt) {
            return;
          }

          if (!data.occurredAt) {
            return;
          }

          nextLogs.push({
            id: docSnap.id,
            standardId: data.standardId,
            value: data.value,
            occurredAtMs: data.occurredAt.toMillis(),
          });
        });
        setLogs(nextLogs);
        setLogsLoading(false);
      },
      (err) => {
        setLogsError(err);
        setLogsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, standardId, standard, refreshToken]);

  const history = useMemo(() => {
    if (!standard || logs.length === 0) {
      return [];
    }
    return computeStandardHistory(standard, logs, resolvedTimezone);
  }, [standard, logs, resolvedTimezone]);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
    setLogsError(null);
  }, []);

  return {
    history,
    loading: logsLoading,
    error: logsError,
    refresh,
  };
}
