import { useEffect, useMemo, useState } from 'react';
import type { ActivityHistoryDoc } from '@minimum-standards/shared-model';
import type { TimeRange } from '../components/RangeFilterDrawer';
import { firebaseAuth } from '../firebase/firebaseApp';
import { useStandards } from './useStandards';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { listenActivityHistoryForStandard } from '../utils/activityHistoryFirestore';
import { mergeActivityHistoryRows, MergedActivityHistoryRow } from '../utils/activityHistory';
import { buildStandardSummaryCards, StandardSummaryCard } from '../utils/scorecardSummary';

const TIME_RANGE_DAYS: Record<TimeRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'All': null,
};

/**
 * Hook that manages multi-standard Firestore subscriptions and computes
 * summary cards for the scorecard summary screen.
 *
 * Uses only persisted activity history rows (completed periods). The current
 * in-progress period is not reflected in summary totals — when the user taps
 * through to the detail screen they see full data including the current period.
 */
export type ScorecardSection = {
  title: string;
  data: StandardSummaryCard[];
};

export function useScorecardSummary(): {
  cards: StandardSummaryCard[];
  sections: ScorecardSection[];
  loading: boolean;
  error: Error | null;
} {
  const userId = firebaseAuth.currentUser?.uid ?? null;
  const { standards, loading: standardsLoading, error: standardsError } = useStandards();
  const scorecardTimeRange = useUIPreferencesStore((s) => s.scorecardTimeRange);
  const scorecardSort = useUIPreferencesStore((s) => s.scorecardSort);
  const showInactiveStandards = useUIPreferencesStore((s) => s.showInactiveStandards);

  const [persistedRowsByStandard, setPersistedRowsByStandard] = useState<
    Record<string, ActivityHistoryDoc[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<Error | null>(null);

  // Determine which standards are relevant
  const relevantStandardIds = useMemo(() => {
    const ids: string[] = [];

    for (const standard of standards) {
      if (showInactiveStandards) {
        ids.push(standard.id);
      } else if (standard.state === 'active' && standard.archivedAtMs === null) {
        ids.push(standard.id);
      }
    }

    return ids.sort();
  }, [standards, showInactiveStandards]);

  // Stable string key for the standard IDs array to use as a useEffect dependency
  const relevantStandardIdsKey = relevantStandardIds.join(',');

  // Subscribe to activity history for each relevant standard
  useEffect(() => {
    if (!userId || relevantStandardIds.length === 0) {
      setPersistedRowsByStandard({});
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    const unsubscribes: (() => void)[] = [];
    const rowsMap: Record<string, ActivityHistoryDoc[]> = {};
    let loadedCount = 0;

    for (const stdId of relevantStandardIds) {
      const unsub = listenActivityHistoryForStandard({
        userId,
        standardId: stdId,
        onNext: (docs) => {
          rowsMap[stdId] = docs;
          loadedCount += 1;
          // Update state with a copy to trigger re-render
          setPersistedRowsByStandard({ ...rowsMap });
          if (loadedCount >= relevantStandardIds.length) {
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
  }, [userId, relevantStandardIdsKey]);

  // Merge persisted rows (no synthetic current-period rows in the simplified approach)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const mergedRowsByStandard = useMemo(() => {
    const result: Record<string, MergedActivityHistoryRow[]> = {};

    for (const standardId of relevantStandardIds) {
      const persisted = persistedRowsByStandard[standardId] ?? [];
      const merged = mergeActivityHistoryRows({
        persistedRows: persisted,
        syntheticRows: [],
        timezone,
        nowMs: Date.now(),
      });
      result[standardId] = merged;
    }

    return result;
  }, [relevantStandardIds, persistedRowsByStandard, timezone]);

  // Apply time range filter
  const filteredRowsByStandard = useMemo(() => {
    const nowMs = Date.now();
    const rangeDays = TIME_RANGE_DAYS[scorecardTimeRange];
    const rangeStartMs = rangeDays ? nowMs - rangeDays * 24 * 60 * 60 * 1000 : 0;

    const result: Record<string, MergedActivityHistoryRow[]> = {};

    for (const standardId of relevantStandardIds) {
      const rows = mergedRowsByStandard[standardId] ?? [];
      let filtered: MergedActivityHistoryRow[];

      if (scorecardTimeRange === 'All') {
        filtered = rows;
      } else {
        filtered = rows.filter(
          (row) => row.periodStartMs < nowMs && row.periodEndMs >= rangeStartMs
        );
      }
      result[standardId] = filtered;
    }

    return result;
  }, [relevantStandardIds, mergedRowsByStandard, scorecardTimeRange]);

  // Build final summary cards
  const cards = useMemo(() => {
    return buildStandardSummaryCards({
      standards,
      mergedRowsByStandard: filteredRowsByStandard,
      includeInactive: showInactiveStandards,
      sort: scorecardSort,
    });
  }, [standards, filteredRowsByStandard, showInactiveStandards, scorecardSort]);

  const sections = useMemo(() => {
    const active = cards.filter((c) => c.isActive);
    const inactive = cards.filter((c) => !c.isActive);
    const result: ScorecardSection[] = [];
    if (active.length > 0) result.push({ title: 'Active', data: active });
    if (inactive.length > 0) result.push({ title: 'Inactive', data: inactive });
    return result;
  }, [cards]);

  // Aggregate loading state: loading until standards AND history are all ready
  const loading = standardsLoading || historyLoading;

  // First error encountered wins
  const error = standardsError ?? historyError ?? null;

  return { cards, sections, loading, error };
}
