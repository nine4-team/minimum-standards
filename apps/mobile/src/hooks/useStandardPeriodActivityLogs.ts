import { useEffect, useState, useMemo } from 'react';
import {
  FirebaseFirestoreTypes,
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from '@react-native-firebase/firestore';
import { Standard, calculatePeriodWindow } from '@minimum-standards/shared-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { useAuthStore } from '../stores/authStore';
import { useActivityLogOperationStore } from '../stores/activityLogOperationStore';
import { decorateActivityLogsWithOperationStatus } from '../utils/activityLogMutations';

export interface ActivityLog {
  id: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
  note: string | null;
  hasPendingWrites?: boolean;
  syncStatus?: 'pending' | 'synced';
}

export interface UseStandardPeriodActivityLogsResult {
  logs: ActivityLog[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Hook to fetch activity logs for a specific standard within a period window.
 * If period boundaries are not provided, calculates them for the current period.
 */
export function useStandardPeriodActivityLogs(
  standardId: string | null,
  periodStartMs?: number,
  periodEndMs?: number,
  standard?: Standard | null
): UseStandardPeriodActivityLogsResult {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);

  const userId = useAuthStore((state) => state.authenticatedUid);
  const operations = useActivityLogOperationStore((state) => state.operationsByLogId);
  const pageSize = 50; // Configurable page size

  // Calculate period boundaries if not provided
  const periodBoundaries = useMemo(() => {
    if (periodStartMs !== undefined && periodEndMs !== undefined) {
      return { startMs: periodStartMs, endMs: periodEndMs };
    }

    if (standard && !periodStartMs && !periodEndMs) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const window = calculatePeriodWindow(Date.now(), standard.cadence, timezone, {
        periodStartPreference: standard.periodStartPreference,
      });
      return { startMs: window.startMs, endMs: window.endMs };
    }

    return null;
  }, [periodStartMs, periodEndMs, standard]);

  useEffect(() => {
    if (!userId || !standardId || !periodBoundaries) {
      setLoading(false);
      setLogs([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLastDoc(null);

    const logsQuery = query(
      collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
      where('standardId', '==', standardId),
      where('occurredAt', '>=', Timestamp.fromMillis(periodBoundaries.startMs)),
      where('occurredAt', '<', Timestamp.fromMillis(periodBoundaries.endMs)),
      where('deletedAt', '==', null),
      orderBy('occurredAt', 'desc'), // Most recent first
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const nextLogs: ActivityLog[] = [];
        snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const data = docSnap.data() as {
            standardId?: string;
            value?: number;
            occurredAt?: FirebaseFirestoreTypes.Timestamp;
            note?: string | null;
            deletedAt?: FirebaseFirestoreTypes.Timestamp | null;
          };

          if (
            !data ||
            typeof data.standardId !== 'string' ||
            typeof data.value !== 'number' ||
            !data.occurredAt ||
            data.deletedAt
          ) {
            return;
          }

          nextLogs.push({
            id: docSnap.id,
            standardId: data.standardId,
            value: data.value,
            occurredAtMs: data.occurredAt.toMillis(),
            note: data.note ?? null,
            hasPendingWrites: docSnap.metadata?.hasPendingWrites ?? false,
          });
        });

        setLogs(nextLogs);
        setHasMore(snapshot.size === pageSize);
        setLastDoc(snapshot.size > 0 ? snapshot.docs[snapshot.size - 1] : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, standardId, periodBoundaries]);

  const loadMore = () => {
    if (!userId || !standardId || !periodBoundaries || !lastDoc || !hasMore || loading) {
      return;
    }

    setLoading(true);

    const logsQuery = query(
      collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
      where('standardId', '==', standardId),
      where('occurredAt', '>=', Timestamp.fromMillis(periodBoundaries.startMs)),
      where('occurredAt', '<', Timestamp.fromMillis(periodBoundaries.endMs)),
      where('deletedAt', '==', null),
      orderBy('occurredAt', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const nextLogs: ActivityLog[] = [];
        snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const data = docSnap.data() as {
            standardId?: string;
            value?: number;
            occurredAt?: FirebaseFirestoreTypes.Timestamp;
            note?: string | null;
            deletedAt?: FirebaseFirestoreTypes.Timestamp | null;
          };

          if (
            !data ||
            typeof data.standardId !== 'string' ||
            typeof data.value !== 'number' ||
            !data.occurredAt ||
            data.deletedAt
          ) {
            return;
          }

          nextLogs.push({
            id: docSnap.id,
            standardId: data.standardId,
            value: data.value,
            occurredAtMs: data.occurredAt.toMillis(),
            note: data.note ?? null,
            hasPendingWrites: docSnap.metadata?.hasPendingWrites ?? false,
          });
        });

        setLogs(prev => [...prev, ...nextLogs]);
        setHasMore(snapshot.size === pageSize);
        setLastDoc(snapshot.size > 0 ? snapshot.docs[snapshot.size - 1] : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  };

  return {
    logs: decorateActivityLogsWithOperationStatus(logs, operations),
    loading,
    error,
    hasMore,
    loadMore,
  };
}
