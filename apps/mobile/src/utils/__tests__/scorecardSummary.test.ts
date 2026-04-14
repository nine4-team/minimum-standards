import type { Activity, Standard } from '@minimum-standards/shared-model';
import type { MergedActivityHistoryRow } from '../activityHistory';
import {
  aggregatePeriodStats,
  buildActivitySummaryCards,
  type ActivitySummaryCard,
} from '../scorecardSummary';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Push-ups',
  unit: 'reps',
  notes: null,
  createdAtMs: 1000,
  updatedAtMs: 1000,
  deletedAtMs: null,
  ...overrides,
});

const makeStandard = (overrides: Partial<Standard> = {}): Standard => ({
  id: 'std-1',
  activityId: 'act-1',
  minimum: 100,
  unit: 'reps',
  cadence: { interval: 1, unit: 'week' },
  state: 'active',
  summary: '100 reps / week',
  archivedAtMs: null,
  createdAtMs: 1000,
  updatedAtMs: 1000,
  deletedAtMs: null,
  sessionConfig: {
    sessionLabel: 'session',
    sessionsPerCadence: 1,
    volumePerSession: 100,
  },
  ...overrides,
});

const makeRow = (
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregatePeriodStats', () => {
  test('single standard, all Met', () => {
    const rows = [
      makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 10, status: 'Met' }),
      makeRow({ standardId: 'std-1', periodStartMs: 2000, total: 20, status: 'Met' }),
      makeRow({ standardId: 'std-1', periodStartMs: 3000, total: 30, status: 'Met' }),
    ];

    const result = aggregatePeriodStats(rows);

    expect(result.completedCount).toBe(3);
    expect(result.metCount).toBe(3);
    expect(result.totalVolume).toBe(60);
  });

  test('single standard, mixed statuses', () => {
    const rows = [
      makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 10, status: 'Met' }),
      makeRow({ standardId: 'std-1', periodStartMs: 2000, total: 20, status: 'Missed' }),
      makeRow({ standardId: 'std-1', periodStartMs: 3000, total: 30, status: 'In Progress' }),
    ];

    const result = aggregatePeriodStats(rows);

    // In Progress is excluded from completedCount
    expect(result.completedCount).toBe(2);
    // Only Met rows count toward metCount
    expect(result.metCount).toBe(1);
    expect(result.totalVolume).toBe(60);
  });

  test('each row counts as its own period regardless of periodStartMs', () => {
    const rows = [
      makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 10, status: 'Met' }),
      makeRow({ standardId: 'std-2', periodStartMs: 1000, total: 25, status: 'Met' }),
    ];

    const result = aggregatePeriodStats(rows);

    // Each row = 1 period, no dedup
    expect(result.completedCount).toBe(2);
    expect(result.metCount).toBe(2);
    expect(result.totalVolume).toBe(35);
  });

  test('Met and Missed rows both count as completed', () => {
    const rows = [
      makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 10, status: 'Met' }),
      makeRow({ standardId: 'std-2', periodStartMs: 1000, total: 5, status: 'Missed' }),
    ];

    const result = aggregatePeriodStats(rows);

    expect(result.completedCount).toBe(2);
    expect(result.metCount).toBe(1);
    expect(result.totalVolume).toBe(15);
  });

  test('In Progress rows excluded from completedCount', () => {
    const rows = [
      makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 10, status: 'Met' }),
      makeRow({ standardId: 'std-2', periodStartMs: 2000, total: 5, status: 'In Progress' }),
    ];

    const result = aggregatePeriodStats(rows);

    expect(result.completedCount).toBe(1);
    expect(result.metCount).toBe(1);
    expect(result.totalVolume).toBe(15);
  });

  test('empty input returns all zeros', () => {
    const result = aggregatePeriodStats([]);

    expect(result.completedCount).toBe(0);
    expect(result.metCount).toBe(0);
    expect(result.totalVolume).toBe(0);
  });
});

describe('buildActivitySummaryCards', () => {
  // ---- 1. Happy path -------------------------------------------------------
  test('aggregates two activities with mixed Met/Missed rows correctly', () => {
    const activities = [
      makeActivity({ id: 'act-1', name: 'Push-ups', unit: 'reps' }),
      makeActivity({ id: 'act-2', name: 'Running', unit: 'miles' }),
    ];

    const standards = [
      makeStandard({ id: 'std-1', activityId: 'act-1' }),
      makeStandard({ id: 'std-2', activityId: 'act-2' }),
    ];

    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-1': [
        makeRow({ standardId: 'std-1', periodStartMs: 1000, total: 30, status: 'Met' }),
        makeRow({ standardId: 'std-1', periodStartMs: 2000, total: 20, status: 'Missed' }),
        makeRow({ standardId: 'std-1', periodStartMs: 3000, total: 50, status: 'Met' }),
      ],
      'act-2': [
        makeRow({ standardId: 'std-2', periodStartMs: 1000, total: 5, status: 'Met' }),
        makeRow({ standardId: 'std-2', periodStartMs: 2000, total: 3, status: 'Missed' }),
      ],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(result).toHaveLength(2);

    // Sorted alphabetically: Push-ups before Running
    const pushups = result[0];
    expect(pushups.activityId).toBe('act-1');
    expect(pushups.activityName).toBe('Push-ups');
    expect(pushups.unit).toBe('reps');
    expect(pushups.totalVolume).toBe(100);
    expect(pushups.completedCount).toBe(3);
    expect(pushups.metCount).toBe(2);
    expect(pushups.percentMet).toBe(67); // Math.round(2/3 * 100)
    expect(pushups.totalPeriods).toBe(3);
    expect(pushups.countMetLabel).toBe('2/3 periods');

    const running = result[1];
    expect(running.activityId).toBe('act-2');
    expect(running.activityName).toBe('Running');
    expect(running.unit).toBe('miles');
    expect(running.totalVolume).toBe(8);
    expect(running.completedCount).toBe(2);
    expect(running.metCount).toBe(1);
    expect(running.percentMet).toBe(50);
    expect(running.totalPeriods).toBe(2);
    expect(running.countMetLabel).toBe('1/2 periods');
  });

  // ---- 2. All "In Progress" -----------------------------------------------
  test('activity with only In Progress rows yields percentMet=0 and completedCount=0', () => {
    const activities = [makeActivity()];
    const standards = [makeStandard()];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-1': [
        makeRow({ total: 10, status: 'In Progress' }),
        makeRow({ total: 20, status: 'In Progress' }),
      ],
    };

    const [card] = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(card.totalVolume).toBe(30);
    expect(card.completedCount).toBe(0);
    expect(card.metCount).toBe(0);
    expect(card.percentMet).toBe(0);
    expect(card.totalPeriods).toBe(2);
    expect(card.countMetLabel).toBe('0/0 periods');
  });

  // ---- 3. Zero total volume ------------------------------------------------
  test('activity where all rows have total=0', () => {
    const activities = [makeActivity()];
    const standards = [makeStandard()];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-1': [
        makeRow({ periodStartMs: 1000, total: 0, status: 'Missed' }),
        makeRow({ periodStartMs: 2000, total: 0, status: 'Met' }),
      ],
    };

    const [card] = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(card.totalVolume).toBe(0);
    expect(card.totalVolumeFormatted).toBe('0');
    expect(card.completedCount).toBe(2);
    expect(card.metCount).toBe(1);
    expect(card.percentMet).toBe(50);
  });

  // ---- 4. includeInactive=false filters out archived-only activities -------
  test('includeInactive=false excludes activities with only archived standards', () => {
    const activities = [
      makeActivity({ id: 'act-active', name: 'Active Activity' }),
      makeActivity({ id: 'act-archived', name: 'Archived Activity' }),
    ];

    const standards = [
      makeStandard({
        id: 'std-active',
        activityId: 'act-active',
        state: 'active',
        archivedAtMs: null,
      }),
      makeStandard({
        id: 'std-archived',
        activityId: 'act-archived',
        state: 'archived',
        archivedAtMs: 5000,
      }),
    ];

    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-active': [makeRow({ total: 10, status: 'Met' })],
      'act-archived': [makeRow({ total: 20, status: 'Met' })],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].activityId).toBe('act-active');
  });

  // ---- 5. includeInactive=true includes archived-only activities -----------
  test('includeInactive=true includes activities with only archived standards', () => {
    const activities = [
      makeActivity({ id: 'act-active', name: 'Active Activity' }),
      makeActivity({ id: 'act-archived', name: 'Archived Activity' }),
    ];

    const standards = [
      makeStandard({
        id: 'std-active',
        activityId: 'act-active',
        state: 'active',
        archivedAtMs: null,
      }),
      makeStandard({
        id: 'std-archived',
        activityId: 'act-archived',
        state: 'archived',
        archivedAtMs: 5000,
      }),
    ];

    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-active': [makeRow({ total: 10, status: 'Met' })],
      'act-archived': [makeRow({ total: 20, status: 'Met' })],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: true,
    });

    expect(result).toHaveLength(2);
    const ids = result.map((c) => c.activityId);
    expect(ids).toContain('act-active');
    expect(ids).toContain('act-archived');
  });

  // ---- 6. Empty inputs -----------------------------------------------------
  test('returns empty array when no activities, standards, or rows are provided', () => {
    const result = buildActivitySummaryCards({
      activities: [],
      standards: [],
      mergedRowsByActivity: {},
      includeInactive: false,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when includeInactive=true with no data', () => {
    const result = buildActivitySummaryCards({
      activities: [],
      standards: [],
      mergedRowsByActivity: {},
      includeInactive: true,
    });

    expect(result).toEqual([]);
  });

  // ---- 7. Activity exists but has no rows ----------------------------------
  test('activity with no rows shows zero totals', () => {
    const activities = [makeActivity()];
    const standards = [makeStandard()];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {};

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(result).toHaveLength(1);
    const [card] = result;
    expect(card.activityId).toBe('act-1');
    expect(card.totalVolume).toBe(0);
    expect(card.totalVolumeFormatted).toBe('0');
    expect(card.completedCount).toBe(0);
    expect(card.metCount).toBe(0);
    expect(card.percentMet).toBe(0);
    expect(card.totalPeriods).toBe(0);
    expect(card.countMetLabel).toBe('0/0 periods');
  });

  // ---- 8. Alphabetical sort ------------------------------------------------
  test('results are sorted alphabetically by activity name', () => {
    const activities = [
      makeActivity({ id: 'act-z', name: 'Yoga' }),
      makeActivity({ id: 'act-a', name: 'Archery' }),
      makeActivity({ id: 'act-m', name: 'Meditation' }),
    ];

    const standards = [
      makeStandard({ id: 'std-z', activityId: 'act-z' }),
      makeStandard({ id: 'std-a', activityId: 'act-a' }),
      makeStandard({ id: 'std-m', activityId: 'act-m' }),
    ];

    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-z': [makeRow({ total: 1, status: 'Met' })],
      'act-a': [makeRow({ total: 2, status: 'Met' })],
      'act-m': [makeRow({ total: 3, status: 'Met' })],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(result.map((c) => c.activityName)).toEqual([
      'Archery',
      'Meditation',
      'Yoga',
    ]);
  });

  // ---- Edge: standard with state=active but archivedAtMs set ---------------
  test('standard with state=active but archivedAtMs set is NOT considered active', () => {
    const activities = [makeActivity({ id: 'act-1', name: 'Activity' })];
    const standards = [
      makeStandard({
        id: 'std-1',
        activityId: 'act-1',
        state: 'active',
        archivedAtMs: 9999,
      }),
    ];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-1': [makeRow({ total: 10, status: 'Met' })],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    // archivedAtMs !== null means it fails the active check
    expect(result).toHaveLength(0);
  });

  // ---- Edge: activity exists in activities list but has no standards --------
  test('activity with no standards is excluded even when includeInactive=true', () => {
    const activities = [makeActivity({ id: 'act-orphan', name: 'Orphan' })];
    const standards: Standard[] = [];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-orphan': [makeRow({ total: 10, status: 'Met' })],
    };

    const result = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: true,
    });

    // No standard references act-orphan, so it won't appear in relevantActivityIds
    expect(result).toHaveLength(0);
  });

  // ---- Edge: totalVolumeFormatted uses locale formatting -------------------
  test('totalVolumeFormatted uses Intl number formatting', () => {
    const activities = [makeActivity()];
    const standards = [makeStandard()];
    const mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]> = {
      'act-1': [
        makeRow({ total: 1500, status: 'Met' }),
        makeRow({ total: 500, status: 'Met' }),
      ],
    };

    const [card] = buildActivitySummaryCards({
      activities,
      standards,
      mergedRowsByActivity,
      includeInactive: false,
    });

    expect(card.totalVolume).toBe(2000);
    // Intl.NumberFormat('en-US') formats 2000 as "2,000"
    expect(card.totalVolumeFormatted).toBe('2,000');
  });
});
