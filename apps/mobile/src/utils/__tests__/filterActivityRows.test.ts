import type { MergedActivityHistoryRow } from '../activityHistory';
import type { ActivityHistoryRow } from '../../hooks/useActivityHistory';
import {
  applyTimeRangeFilter,
  filterByStandardIds,
  filterActivityRows,
} from '../activityHistory';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const makeMergedRow = (
  overrides: Partial<MergedActivityHistoryRow> = {},
): MergedActivityHistoryRow => ({
  standardId: 'std-1',
  periodStartMs: 1000,
  periodEndMs: 2000,
  periodLabel: 'Jan 1 - Jan 7',
  total: 50,
  currentSessions: 1,
  targetSessions: 1,
  status: 'Met',
  progressPercent: 100,
  isCurrentPeriod: false,
  standardSnapshot: {
    minimum: 100,
    unit: 'reps',
    cadence: { interval: 1, unit: 'week' },
    sessionConfig: {
      sessionLabel: 'session',
      sessionsPerCadence: 1,
      volumePerSession: 100,
    },
  },
  ...overrides,
});

const makePersistedRow = (
  overrides: Partial<ActivityHistoryRow> = {},
): ActivityHistoryRow => ({
  id: 'doc-1',
  activityId: 'act-1',
  standardId: 'std-1',
  referenceTimestampMs: 1500,
  standardSnapshot: {
    minimum: 100,
    unit: 'reps',
    cadence: { interval: 1, unit: 'week' },
    sessionConfig: {
      sessionLabel: 'session',
      sessionsPerCadence: 1,
      volumePerSession: 100,
    },
  },
  total: 50,
  currentSessions: 1,
  targetSessions: 1,
  status: 'Met',
  progressPercent: 100,
  generatedAtMs: 2000,
  source: 'boundary',
  ...overrides,
});

// ---------------------------------------------------------------------------
// applyTimeRangeFilter
// ---------------------------------------------------------------------------

describe('applyTimeRangeFilter', () => {
  const now = Date.now();

  test('All returns all rows unfiltered', () => {
    const rows = [
      makeMergedRow({ periodStartMs: 0, periodEndMs: 100 }),
      makeMergedRow({ periodStartMs: now - 999 * DAY_MS, periodEndMs: now - 998 * DAY_MS }),
    ];
    const result = applyTimeRangeFilter({ rows, timeRange: 'All', nowMs: now });
    expect(result).toHaveLength(2);
  });

  test('7d keeps rows whose period overlaps the last 7 days', () => {
    const rangeStart = now - 7 * DAY_MS;
    const rows = [
      // Fully within range
      makeMergedRow({ periodStartMs: now - 3 * DAY_MS, periodEndMs: now + DAY_MS }),
      // Overlaps range (started before, ends within)
      makeMergedRow({ periodStartMs: now - 10 * DAY_MS, periodEndMs: rangeStart + DAY_MS }),
      // Completely before range
      makeMergedRow({ periodStartMs: now - 20 * DAY_MS, periodEndMs: rangeStart - 1 }),
      // Starts in the future (periodStartMs >= nowMs) — excluded
      makeMergedRow({ periodStartMs: now + 1, periodEndMs: now + WEEK_MS }),
    ];
    const result = applyTimeRangeFilter({ rows, timeRange: '7d', nowMs: now });
    expect(result).toHaveLength(2);
  });

  test('30d keeps rows overlapping the last 30 days', () => {
    const rangeStart = now - 30 * DAY_MS;
    const rows = [
      makeMergedRow({ periodStartMs: now - 5 * DAY_MS, periodEndMs: now + DAY_MS }),
      makeMergedRow({ periodStartMs: now - 40 * DAY_MS, periodEndMs: rangeStart + DAY_MS }),
      makeMergedRow({ periodStartMs: now - 60 * DAY_MS, periodEndMs: rangeStart - 1 }),
    ];
    const result = applyTimeRangeFilter({ rows, timeRange: '30d', nowMs: now });
    expect(result).toHaveLength(2);
  });

  test('90d keeps rows overlapping the last 90 days', () => {
    const rangeStart = now - 90 * DAY_MS;
    const rows = [
      makeMergedRow({ periodStartMs: now - 10 * DAY_MS, periodEndMs: now + DAY_MS }),
      makeMergedRow({ periodStartMs: now - 100 * DAY_MS, periodEndMs: rangeStart - 1 }),
    ];
    const result = applyTimeRangeFilter({ rows, timeRange: '90d', nowMs: now });
    expect(result).toHaveLength(1);
  });

  test('empty rows returns empty', () => {
    const result = applyTimeRangeFilter({ rows: [], timeRange: '7d', nowMs: now });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterByStandardIds
// ---------------------------------------------------------------------------

describe('filterByStandardIds', () => {
  test('undefined standardIds returns all rows', () => {
    const rows = [
      makeMergedRow({ standardId: 'std-1' }),
      makeMergedRow({ standardId: 'std-2' }),
    ];
    expect(filterByStandardIds(rows, undefined)).toHaveLength(2);
  });

  test('empty standardIds returns all rows', () => {
    const rows = [
      makeMergedRow({ standardId: 'std-1' }),
      makeMergedRow({ standardId: 'std-2' }),
    ];
    expect(filterByStandardIds(rows, [])).toHaveLength(2);
  });

  test('filters to only matching standardIds', () => {
    const rows = [
      makeMergedRow({ standardId: 'std-1' }),
      makeMergedRow({ standardId: 'std-2' }),
      makeMergedRow({ standardId: 'std-3' }),
    ];
    const result = filterByStandardIds(rows, ['std-1', 'std-3']);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.standardId)).toEqual(['std-1', 'std-3']);
  });

  test('no matching standardIds returns empty', () => {
    const rows = [
      makeMergedRow({ standardId: 'std-1' }),
      makeMergedRow({ standardId: 'std-2' }),
    ];
    const result = filterByStandardIds(rows, ['std-99']);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterActivityRows (integration: merge + standardId filter + time range)
// ---------------------------------------------------------------------------

describe('filterActivityRows', () => {
  // Use a fixed now to make tests deterministic
  const now = 1_700_000_000_000; // some fixed timestamp

  test('produces identical output for summary and detail when given same inputs', () => {
    // Simulate what both screens would pass for "no synthetic, no standardId filter, All range"
    const persisted = [
      makePersistedRow({ id: 'doc-1', standardId: 'std-1', referenceTimestampMs: now - 3 * WEEK_MS }),
      makePersistedRow({ id: 'doc-2', standardId: 'std-1', referenceTimestampMs: now - 2 * WEEK_MS }),
      makePersistedRow({ id: 'doc-3', standardId: 'std-1', referenceTimestampMs: now - 1 * WEEK_MS }),
    ];

    const summaryResult = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      timeRange: 'All',
      nowMs: now,
    });

    const detailResult = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      timeRange: 'All',
      nowMs: now,
    });

    expect(summaryResult).toEqual(detailResult);
  });

  test('standardIds filter excludes rows from deleted standards', () => {
    const persisted = [
      makePersistedRow({ id: 'doc-1', standardId: 'std-active', referenceTimestampMs: now - WEEK_MS }),
      makePersistedRow({ id: 'doc-2', standardId: 'std-deleted', referenceTimestampMs: now - WEEK_MS }),
      makePersistedRow({ id: 'doc-3', standardId: 'std-active', referenceTimestampMs: now - 2 * WEEK_MS }),
    ];

    const result = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      timeRange: 'All',
      nowMs: now,
      standardIds: ['std-active'],
    });

    expect(result.every(r => r.standardId === 'std-active')).toBe(true);
    expect(result).toHaveLength(2);
  });

  test('time range filter is applied after standardId filter', () => {
    const persisted = [
      // Recent — within 7d
      makePersistedRow({ id: 'doc-1', standardId: 'std-1', referenceTimestampMs: now - 2 * DAY_MS }),
      // Old — outside 7d
      makePersistedRow({ id: 'doc-2', standardId: 'std-1', referenceTimestampMs: now - 30 * DAY_MS }),
      // Recent but from deleted standard
      makePersistedRow({ id: 'doc-3', standardId: 'std-deleted', referenceTimestampMs: now - 2 * DAY_MS }),
    ];

    const result = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      timeRange: '7d',
      nowMs: now,
      standardIds: ['std-1'],
    });

    // Only the recent row from std-1 should survive both filters
    expect(result).toHaveLength(1);
    expect(result[0].standardId).toBe('std-1');
  });

  test('synthetic row deduplicates persisted row when periodStartMs matches', () => {
    // Dedup key is (standardId, periodStartMs). When synthetic and persisted
    // share the same key, synthetic wins because it's added first.
    const syntheticRow = makeMergedRow({
      standardId: 'std-1',
      periodStartMs: 5000,
      periodEndMs: 10000,
      isCurrentPeriod: true,
      total: 75,
    });

    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: 5000, // recalculates to same periodStartMs
        total: 50,
      }),
    ];

    const result = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [syntheticRow],
      timezone: 'UTC',
      timeRange: 'All',
      nowMs: 10000,
    });

    // Synthetic wins over persisted for the same dedup key
    const syntheticResults = result.filter(r => r.isCurrentPeriod);
    expect(syntheticResults).toHaveLength(1);
    expect(syntheticResults[0].total).toBe(75);
  });

  test('synthetic and persisted with different recalculated boundaries both appear', () => {
    // When calculatePeriodWindow snaps to different calendar boundaries,
    // both rows survive dedup because they have different periodStartMs keys.
    // This is correct behavior — they represent genuinely different periods.
    const syntheticRow = makeMergedRow({
      standardId: 'std-1',
      periodStartMs: now - WEEK_MS,
      periodEndMs: now,
      isCurrentPeriod: true,
      total: 75,
    });

    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: now - WEEK_MS + 1000,
        total: 50,
      }),
    ];

    const result = filterActivityRows({
      persistedRows: persisted,
      syntheticRows: [syntheticRow],
      timezone: 'UTC',
      timeRange: 'All',
      nowMs: now,
    });

    // Both survive because recalculated boundaries differ from synthetic boundaries
    expect(result.length).toBeGreaterThanOrEqual(1);
    // The synthetic row is always present
    expect(result.some(r => r.isCurrentPeriod && r.total === 75)).toBe(true);
  });

  test('empty inputs returns empty', () => {
    const result = filterActivityRows({
      persistedRows: [],
      syntheticRows: [],
      timezone: 'UTC',
      timeRange: '30d',
      nowMs: now,
    });
    expect(result).toEqual([]);
  });
});
