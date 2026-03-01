import type { ActivityHistoryRow } from '../../hooks/useActivityHistory';
import type { MergedActivityHistoryRow } from '../activityHistory';
import { mergeActivityHistoryRows } from '../activityHistory';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Jan 1, 2024 00:00:00 UTC (Monday).
 * Weekly cadence with default preference snaps to Monday boundaries:
 *   periodStart = Jan 1 00:00 UTC  (1704067200000)
 *   periodEnd   = Jan 8 00:00 UTC  (1704672000000)
 */
const JAN1_2024_MS = 1704067200000;
const JAN8_2024_MS = 1704672000000;

/**
 * A timestamp well after Jan 8, 2024 — used as nowMs when we want
 * the Jan 1 period to be fully in the past.
 */
const FAR_FUTURE_MS = 1800000000000; // ~2027

/**
 * Feb 23, 2026 00:00:00 UTC (Monday).
 * Period end = Mar 2, 2026 00:00 UTC (1772409600000).
 * Used for testing "stays In Progress" — set nowMs within the period.
 */
const FEB23_2026_MS = 1771804800000;
const MAR2_2026_MS = 1772409600000;

const makePersistedRow = (
  overrides: Partial<ActivityHistoryRow> = {},
): ActivityHistoryRow => ({
  id: 'doc-1',
  activityId: 'act-1',
  standardId: 'std-1',
  referenceTimestampMs: JAN1_2024_MS + 1000, // mid-period, snaps to Jan 1
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
// Status re-derivation tests
// ---------------------------------------------------------------------------

describe('mergeActivityHistoryRows – status re-derivation', () => {
  test('In Progress -> Met: total >= minimum and period has ended', () => {
    // Persisted row was saved as "In Progress" but total actually meets minimum.
    // Since nowMs > periodEndMs, derivePeriodStatus returns "Met".
    const persisted = [
      makePersistedRow({
        status: 'In Progress',
        total: 150, // >= minimum (100)
        referenceTimestampMs: JAN1_2024_MS + 1000,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS, // well past Jan 8
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Met');
    expect(result[0].total).toBe(150);
  });

  test('In Progress -> Missed: total < minimum and period has ended', () => {
    // Persisted row was "In Progress" with total below minimum.
    // Period is over, so it should become "Missed".
    const persisted = [
      makePersistedRow({
        status: 'In Progress',
        total: 30, // < minimum (100)
        referenceTimestampMs: JAN1_2024_MS + 1000,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Missed');
  });

  test('In Progress stays In Progress: nowMs < periodEndMs', () => {
    // Use a reference in Feb 2026 so the period end is in the future relative to nowMs.
    const persisted = [
      makePersistedRow({
        status: 'In Progress',
        total: 30,
        referenceTimestampMs: FEB23_2026_MS + 1000,
      }),
    ];

    // nowMs is within the period (Feb 23 + 1s < Mar 2)
    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FEB23_2026_MS + 2000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('In Progress');
  });

  test('Met stays Met: total >= minimum regardless of nowMs', () => {
    const persisted = [
      makePersistedRow({
        status: 'Met', // persisted as Met
        total: 200, // >= minimum (100)
        referenceTimestampMs: JAN1_2024_MS + 1000,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Met');
  });

  test('Missed stays Missed: total < minimum and period ended', () => {
    const persisted = [
      makePersistedRow({
        status: 'Missed',
        total: 10,
        referenceTimestampMs: JAN1_2024_MS + 1000,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Missed');
  });
});

// ---------------------------------------------------------------------------
// Dedup tests
// ---------------------------------------------------------------------------

describe('mergeActivityHistoryRows – deduplication', () => {
  test('two persisted rows with same (standardId, recalculated periodStartMs) – only first survives', () => {
    // Both rows have referenceTimestampMs in the same week, so they snap to the same periodStartMs.
    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + 1000, // snaps to Jan 1
        total: 80,
      }),
      makePersistedRow({
        id: 'doc-2',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + 5000, // same week, snaps to Jan 1
        total: 90,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    // Both map to key "std-1__1704067200000", so only the first survives
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(80);
  });

  test('two persisted rows with different standardIds are NOT deduped', () => {
    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + 1000,
        total: 80,
      }),
      makePersistedRow({
        id: 'doc-2',
        standardId: 'std-2',
        referenceTimestampMs: JAN1_2024_MS + 1000, // same week, but different standard
        total: 90,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(2);
  });

  test('two persisted rows in different weeks are NOT deduped', () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + 1000, // Week of Jan 1
        total: 80,
      }),
      makePersistedRow({
        id: 'doc-2',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + WEEK_MS + 1000, // Week of Jan 8
        total: 90,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(2);
  });

  test('synthetic row wins over persisted row with same dedup key', () => {
    const syntheticRow: MergedActivityHistoryRow = {
      standardId: 'std-1',
      periodStartMs: JAN1_2024_MS,
      periodEndMs: JAN8_2024_MS,
      periodLabel: '01/01/2024 - 01/07/2024',
      total: 200,
      currentSessions: 3,
      targetSessions: 1,
      status: 'Met',
      progressPercent: 100,
      isCurrentPeriod: true,
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
    };

    const persisted = [
      makePersistedRow({
        id: 'doc-1',
        standardId: 'std-1',
        referenceTimestampMs: JAN1_2024_MS + 1000, // snaps to Jan 1 — same as synthetic
        total: 50,
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [syntheticRow],
      timezone: 'UTC',
      nowMs: JAN1_2024_MS + 2000,
    });

    // Synthetic is added first, so it wins the dedup
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(200);
    expect(result[0].isCurrentPeriod).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Boundary recalculation tests
// ---------------------------------------------------------------------------

describe('mergeActivityHistoryRows – boundary recalculation', () => {
  test('recalculated periodStartMs and periodEndMs match weekly boundaries', () => {
    const persisted = [
      makePersistedRow({
        referenceTimestampMs: JAN1_2024_MS + 3600000, // 1 hour into Jan 1
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].periodStartMs).toBe(JAN1_2024_MS);
    expect(result[0].periodEndMs).toBe(JAN8_2024_MS);
  });

  test('isCurrentPeriod is false for persisted rows', () => {
    const persisted = [makePersistedRow()];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result[0].isCurrentPeriod).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sorting tests
// ---------------------------------------------------------------------------

describe('mergeActivityHistoryRows – sorting', () => {
  test('results are sorted by periodEndMs descending (most recent first)', () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const persisted = [
      makePersistedRow({
        id: 'doc-old',
        referenceTimestampMs: JAN1_2024_MS + 1000, // Week of Jan 1
      }),
      makePersistedRow({
        id: 'doc-new',
        referenceTimestampMs: JAN1_2024_MS + WEEK_MS + 1000, // Week of Jan 8
      }),
    ];

    const result = mergeActivityHistoryRows({
      persistedRows: persisted,
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toHaveLength(2);
    // Most recent period first
    expect(result[0].periodEndMs).toBeGreaterThan(result[1].periodEndMs);
  });
});

// ---------------------------------------------------------------------------
// Empty inputs
// ---------------------------------------------------------------------------

describe('mergeActivityHistoryRows – empty inputs', () => {
  test('empty persisted and empty synthetic returns empty array', () => {
    const result = mergeActivityHistoryRows({
      persistedRows: [],
      syntheticRows: [],
      timezone: 'UTC',
      nowMs: FAR_FUTURE_MS,
    });

    expect(result).toEqual([]);
  });
});
