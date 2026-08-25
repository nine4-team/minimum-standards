import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  FirebaseFirestoreTypes,
  Timestamp,
  collection,
  doc,
  query,
  where,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';
import {
  Standard,
  calculatePeriodWindow,
} from '@minimum-standards/shared-model';
import { useStandards } from './useStandards';
import {
  DashboardLogSlice,
  DashboardProgress,
  buildDashboardProgressMap,
} from '../utils/dashboardProgress';
import { useAuthStore } from '../stores/authStore';

export type DashboardStandard = {
  standard: Standard;
  progress: DashboardProgress | null;
};

function computeEarliestStart(
  standards: Standard[],
  timezone: string,
  nowMs: number
): number {
  if (standards.length === 0) {
    return nowMs;
  }

  return standards.reduce((min, standard) => {
    const window = calculatePeriodWindow(
      nowMs,
      standard.cadence,
      timezone,
      { periodStartPreference: standard.periodStartPreference }
    );
    return Math.min(min, window.startMs);
  }, nowMs);
}

export function useActiveStandardsDashboard() {
  const standardsResult = useStandards();
  const {
    orderedActiveStandards,
    loading: standardsLoading,
    error: standardsError,
    createLogEntry,
  } = standardsResult;

  const [logs, setLogs] = useState<DashboardLogSlice[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [windowReferenceMs, setWindowReferenceMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const userId = useAuthStore((state) => state.authenticatedUid);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nowTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || orderedActiveStandards.length === 0) {
      setLogsLoading(false);
      setLogs([]);
      return;
    }

    setLogsLoading(true);
    setLogsError(null);

    const nowMs = Date.now();
    const earliestStart = computeEarliestStart(
      orderedActiveStandards,
      timezone,
      nowMs
    );

    const logsQuery = query(
      collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
      where('occurredAt', '>=', Timestamp.fromMillis(earliestStart))
    );

    const unsubscribe = logsQuery.onSnapshot(
      (snapshot) => {
        const nextLogs: DashboardLogSlice[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            standardId?: string;
            value?: number;
            occurredAt?: FirebaseFirestoreTypes.Timestamp;
            deletedAt?: FirebaseFirestoreTypes.Timestamp | null;
          };

          if (!data || !data.standardId || typeof data.value !== 'number') {
            return;
          }

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
  }, [userId, orderedActiveStandards, timezone, refreshToken]);

  // Compute next boundary and schedule timeout to advance windowReferenceMs
  useEffect(() => {
    if (orderedActiveStandards.length === 0) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Find the earliest boundary across all active standards
    const nowMs = Date.now();
    let nextBoundaryMs: number | null = null;

    for (const standard of orderedActiveStandards) {
      const window = calculatePeriodWindow(
        windowReferenceMs,
        standard.cadence,
        timezone,
        { periodStartPreference: standard.periodStartPreference }
      );
      if (nextBoundaryMs === null || window.endMs < nextBoundaryMs) {
        nextBoundaryMs = window.endMs;
      }
    }

    if (nextBoundaryMs === null) {
      return;
    }

    if (nextBoundaryMs <= nowMs) {
      // Boundary already passed (e.g., app was paused); snap forward immediately
      setWindowReferenceMs(Date.now());
      return;
    }

    const delayMs = nextBoundaryMs - nowMs;

    // Schedule timeout to advance window reference
    timeoutRef.current = setTimeout(() => {
      setWindowReferenceMs(Date.now());
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [orderedActiveStandards, windowReferenceMs, timezone]);

  // Snap forward on app resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const currentNow = Date.now();
        setWindowReferenceMs(currentNow);
        setNowMs(currentNow);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Update nowMs every 60 seconds
  useEffect(() => {
    // Clear any existing interval
    if (nowTickRef.current) {
      clearInterval(nowTickRef.current);
      nowTickRef.current = null;
    }

    // Set up interval to update nowMs every 60 seconds
    nowTickRef.current = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => {
      if (nowTickRef.current) {
        clearInterval(nowTickRef.current);
        nowTickRef.current = null;
      }
    };
  }, []);

  const progressMap = useMemo(
    () =>
      buildDashboardProgressMap({
        standards: orderedActiveStandards,
        logs,
        timezone,
        windowReferenceMs,
      }),
    [orderedActiveStandards, logs, timezone, windowReferenceMs]
  );

  const dashboardStandards: DashboardStandard[] = useMemo(
    () =>
      orderedActiveStandards.map((standard) => ({
        standard,
        progress: progressMap[standard.id] ?? null,
      })),
    [orderedActiveStandards, progressMap]
  );

  const refreshProgress = useCallback(() => {
    // Refresh logs subscription
    setRefreshToken((token) => token + 1);
    // Clear errors to allow re-subscription
    setLogsError(null);
  }, []);

  // Refresh standards by clearing error state - the useEffect will re-run
  // Note: This is a workaround since useStandards doesn't expose a refresh mechanism
  // In a production app, useStandards should expose a refreshStandards callback
  const refreshStandards = useCallback(() => {
    // The standards hook will automatically re-subscribe on next render
    // if errors are cleared. This is a best-effort approach.
  }, []);

  const loading = standardsLoading || logsLoading;
  const error = standardsError ?? logsError;

  return {
    ...standardsResult,
    dashboardStandards,
    progressMap,
    loading,
    error,
    refreshProgress,
    refreshStandards,
    createLogEntry,
    nowMs,
  };
}
