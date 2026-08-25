import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  FirebaseFirestoreTypes,
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import { Standard, calculatePeriodWindow } from '@minimum-standards/shared-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { useAuthStore } from '../stores/authStore';

export interface ActivityLogSlice {
  id: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
}

export interface UseActivityLogsResult {
  logs: ActivityLogSlice[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch log slices for the current period windows of standards that reference an activity.
 * Queries are scoped per-standard and bounded to [periodStart, periodEnd) to keep downloads small.
 */
export function useActivityLogs(
  activityId: string | null,
  standards: Standard[],
  timezone: string
): UseActivityLogsResult {
  const [logs, setLogs] = useState<ActivityLogSlice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [windowReferenceMs, setWindowReferenceMs] = useState(() => Date.now());
  const userId = useAuthStore((state) => state.authenticatedUid);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeStandards = useMemo(
    () =>
      standards.filter(
        (standard) =>
          standard.activityId === activityId &&
          standard.state === 'active' &&
          standard.archivedAtMs === null
      ),
    [standards, activityId]
  );

  useEffect(() => {
    if (!userId || !activityId || activeStandards.length === 0) {
      setLoading(false);
      setLogs([]);
      return;
    }

    setLoading(true);
    setError(null);

    const logsByStandard = new Map<string, ActivityLogSlice[]>();
    let pendingStandards = activeStandards.length;

    const subscriptions = activeStandards.map((standard) => {
      const window = calculatePeriodWindow(windowReferenceMs, standard.cadence, timezone, {
        periodStartPreference: standard.periodStartPreference,
      });
      const logsQuery = query(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        where('standardId', '==', standard.id),
        where('occurredAt', '>=', Timestamp.fromMillis(window.startMs)),
        where('occurredAt', '<', Timestamp.fromMillis(window.endMs))
      );

      return onSnapshot(
        logsQuery,
        (snapshot) => {
          const nextLogs: ActivityLogSlice[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as {
              standardId?: string;
              value?: number;
              occurredAt?: FirebaseFirestoreTypes.Timestamp;
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
            });
          });

          logsByStandard.set(standard.id, nextLogs);

          if (pendingStandards > 0) {
            pendingStandards -= 1;
            if (pendingStandards === 0) {
              setLoading(false);
            }
          }

          const merged: ActivityLogSlice[] = [];
          logsByStandard.forEach((list) => {
            merged.push(...list);
          });
          setLogs(merged);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
    });

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [userId, activityId, activeStandards, timezone, windowReferenceMs]);

  // Schedule window refresh at the earliest cadence boundary
  useEffect(() => {
    if (activeStandards.length === 0) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const nowMs = Date.now();
    let nextBoundaryMs: number | null = null;

    for (const standard of activeStandards) {
      const window = calculatePeriodWindow(windowReferenceMs, standard.cadence, timezone, {
        periodStartPreference: standard.periodStartPreference,
      });
      if (nextBoundaryMs === null || window.endMs < nextBoundaryMs) {
        nextBoundaryMs = window.endMs;
      }
    }

    if (nextBoundaryMs === null) {
      return;
    }

    if (nextBoundaryMs <= nowMs) {
      setWindowReferenceMs(Date.now());
      return;
    }

    const delayMs = nextBoundaryMs - nowMs;
    timeoutRef.current = setTimeout(() => {
      setWindowReferenceMs(Date.now());
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [activeStandards, timezone, windowReferenceMs]);

  // Refresh windows on app resume to handle missed boundaries
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setWindowReferenceMs(Date.now());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    logs,
    loading,
    error,
  };
}
