import { useEffect, useMemo, useState } from 'react';
import type { ActivityHistoryDoc } from '@minimum-standards/shared-model';
import type { TimeRange } from '../components/RangeFilterDrawer';
import { firebaseAuth } from '../firebase/firebaseApp';
import { useStandards } from './useStandards';
import { useActivities } from './useActivities';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { listenActivityHistoryForActivity } from '../utils/activityHistoryFirestore';
import { mergeActivityHistoryRows, MergedActivityHistoryRow } from '../utils/activityHistory';
import { buildActivitySummaryCards, ActivitySummaryCard } from '../utils/scorecardSummary';

const TIME_RANGE_DAYS: Record<TimeRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'All': null,
};

/**
 * Hook that manages multi-activity Firestore subscriptions and computes
 * summary cards for the scorecard summary screen.
 *
 * Uses only persisted activity history rows (completed periods). The current
 * in-progress period is not reflected in summary totals — when the user taps
 * through to the detail screen they see full data including the current period.
 */
export function useScorecardSummary(): {
  cards: ActivitySummaryCard[];
  loading: boolean;
  error: Error | null;
} {
  const userId = firebaseAuth.currentUser?.uid ?? null;
  const { standards, loading: standardsLoading, error: standardsError } = useStandards();
  const { allActivities: activities, loading: activitiesLoading, error: activitiesError } = useActivities();
  const scorecardTimeRange = useUIPreferencesStore((s) => s.scorecardTimeRange);
  const showInactiveStandards = useUIPreferencesStore((s) => s.showInactiveStandards);

  const [persistedRowsByActivity, setPersistedRowsByActivity] = useState<
    Record<string, ActivityHistoryDoc[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<Error | null>(null);

  // Determine which activities are relevant based on their standards
  const relevantActivityIds = useMemo(() => {
    const activityHasActiveStandard = new Set<string>();
    const activityHasAnyStandard = new Set<string>();

    for (const standard of standards) {
      activityHasAnyStandard.add(standard.activityId);
      if (standard.state === 'active' && standard.archivedAtMs === null) {
        activityHasActiveStandard.add(standard.activityId);
      }
    }

    const relevantSet = showInactiveStandards
      ? activityHasAnyStandard
      : activityHasActiveStandard;

    return Array.from(relevantSet).sort();
  }, [standards, showInactiveStandards]);

  // Stable string key for the activity IDs array to use as a useEffect dependency
  const relevantActivityIdsKey = relevantActivityIds.join(',');

  // Subscribe to activity history for each relevant activity
  useEffect(() => {
    if (!userId || relevantActivityIds.length === 0) {
      setPersistedRowsByActivity({});
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    const unsubscribes: (() => void)[] = [];
    const rowsMap: Record<string, ActivityHistoryDoc[]> = {};
    let loadedCount = 0;

    for (const actId of relevantActivityIds) {
      const unsub = listenActivityHistoryForActivity({
        userId,
        activityId: actId,
        onNext: (docs) => {
          rowsMap[actId] = docs;
          loadedCount += 1;
          // Update state with a copy to trigger re-render
          setPersistedRowsByActivity({ ...rowsMap });
          if (loadedCount >= relevantActivityIds.length) {
            setHistoryLoading(false);
          }
        },
        onError: (err) => {
          setHistoryError(err);
          setHistoryLoading(false);
        },
      });
      unsubscribes.push(unsub);
    }

    return () => unsubscribes.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, relevantActivityIdsKey]);

  // Merge persisted rows (no synthetic current-period rows in the simplified approach)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const mergedRowsByActivity = useMemo(() => {
    const result: Record<string, MergedActivityHistoryRow[]> = {};

    for (const activityId of relevantActivityIds) {
      const persisted = persistedRowsByActivity[activityId] ?? [];
      const merged = mergeActivityHistoryRows({
        persistedRows: persisted,
        syntheticRows: [],
        timezone,
        nowMs: Date.now(),
      });
      result[activityId] = merged;
    }

    return result;
  }, [relevantActivityIds, persistedRowsByActivity, timezone]);

  // Apply time range filter
  const filteredRowsByActivity = useMemo(() => {
    const nowMs = Date.now();
    const rangeDays = TIME_RANGE_DAYS[scorecardTimeRange];
    const rangeStartMs = rangeDays ? nowMs - rangeDays * 24 * 60 * 60 * 1000 : 0;

    const result: Record<string, MergedActivityHistoryRow[]> = {};

    for (const activityId of relevantActivityIds) {
      const rows = mergedRowsByActivity[activityId] ?? [];
      let filtered: MergedActivityHistoryRow[];

      if (scorecardTimeRange === 'All') {
        filtered = rows;
      } else {
        filtered = rows.filter(
          (row) => row.periodStartMs < nowMs && row.periodEndMs >= rangeStartMs
        );
      }
      result[activityId] = filtered;
    }

    return result;
  }, [relevantActivityIds, mergedRowsByActivity, scorecardTimeRange]);

  // Build final summary cards
  const cards = useMemo(() => {
    return buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity: filteredRowsByActivity,
      includeInactive: showInactiveStandards,
    });
  }, [activities, standards, filteredRowsByActivity, showInactiveStandards]);

  // Aggregate loading state: loading until standards, activities, AND history are all ready
  const loading = standardsLoading || activitiesLoading || historyLoading;

  // First error encountered wins
  const error = standardsError ?? activitiesError ?? historyError ?? null;

  return { cards, loading, error };
}
