import {
  Standard,
  calculatePeriodWindow,
  derivePeriodStatus,
  PeriodStatus,
  PeriodWindow,
} from '@minimum-standards/shared-model';
import { ActivityHistoryRow } from '../hooks/useActivityHistory';

export interface ActivityLogSlice {
  id: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
}

export interface MergedActivityHistoryRow {
  standardId: string;
  periodStartMs: number;
  periodEndMs: number;
  periodLabel: string;
  periodKey?: string;
  standardSnapshot: ActivityHistoryRow['standardSnapshot'];
  total: number;
  currentSessions: number;
  targetSessions: number;
  status: PeriodStatus;
  progressPercent: number;
  isCurrentPeriod: boolean;
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

/**
 * Computes synthetic current period rows for active standards that reference the activity.
 */
export function computeSyntheticCurrentRows(params: {
  standards: Standard[];
  logs: ActivityLogSlice[];
  timezone: string;
  nowMs: number;
}): MergedActivityHistoryRow[] {
  const { standards, logs, timezone, nowMs } = params;

  const syntheticRows: MergedActivityHistoryRow[] = [];

  // Filter to only active standards
  const relevantStandards = standards.filter(
    (standard) =>
      standard.state === 'active' &&
      standard.archivedAtMs === null
  );

  for (const standard of relevantStandards) {
    const window = calculatePeriodWindow(
      nowMs,
      standard.cadence,
      timezone,
      { periodStartPreference: standard.periodStartPreference }
    );

    // Query logs within the current period window [startMs, nowMs)
    const periodLogs = logs.filter(
      (log) =>
        log.standardId === standard.id &&
        log.occurredAtMs >= window.startMs &&
        log.occurredAtMs < nowMs
    );

    const total = periodLogs.reduce((sum, log) => sum + log.value, 0);
    const currentSessions = periodLogs.length;
    const targetSessions = standard.sessionConfig.sessionsPerCadence;
    const status = derivePeriodStatus(total, standard.minimum, nowMs, window.endMs);
    const safeMinimum = Math.max(standard.minimum, 0);
    const ratio = safeMinimum === 0 ? 1 : Math.min(total / safeMinimum, 1);
    const progressPercent = Number((ratio * 100).toFixed(2));

    syntheticRows.push({
      standardId: standard.id,
      periodStartMs: window.startMs,
      periodEndMs: window.endMs,
      periodLabel: window.label,
      periodKey: window.periodKey,
      standardSnapshot: {
        minimum: standard.minimum,
        unit: standard.unit,
        cadence: standard.cadence,
        sessionConfig: standard.sessionConfig,
        periodStartPreference: standard.periodStartPreference,
      },
      total,
      currentSessions,
      targetSessions,
      status,
      progressPercent,
      isCurrentPeriod: true,
    });
  }

  return syntheticRows;
}

/**
 * Merges persisted rows with synthetic current rows, recalculates boundaries for historical rows,
 * deduplicates by (standardId, recalculatedPeriodStartMs), and sorts by recalculatedPeriodEndMs desc.
 */
export function mergeActivityHistoryRows(params: {
  persistedRows: ActivityHistoryRow[];
  syntheticRows: MergedActivityHistoryRow[];
  timezone: string;
  nowMs: number;
}): MergedActivityHistoryRow[] {
  const { persistedRows, syntheticRows, timezone, nowMs } = params;

  // Create a map to track which (standardId, periodStartMs) combinations we've seen
  const seenKeys = new Set<string>();
  const merged: MergedActivityHistoryRow[] = [];

  // First, add synthetic rows (current periods) - these already have correct boundaries
  for (const synthetic of syntheticRows) {
    const key = `${synthetic.standardId}__${synthetic.periodStartMs}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(synthetic);
    }
  }

  // Then, add persisted rows (completed periods) with recalculated boundaries
  for (const persisted of persistedRows) {
    // Recalculate boundaries using historical config + current logic
    const boundaries = recalculateHistoricalBoundaries(persisted, timezone);

    const key = `${persisted.standardId}__${boundaries.startMs}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push({
        standardId: persisted.standardId,
        periodStartMs: boundaries.startMs, // Use recalculated boundaries
        periodEndMs: boundaries.endMs,
        periodLabel: boundaries.label,
        periodKey: boundaries.periodKey ?? `${persisted.standardId}_${boundaries.startMs}`,
        standardSnapshot: persisted.standardSnapshot,
        total: persisted.total,
        currentSessions: persisted.currentSessions,
        targetSessions: persisted.targetSessions,
        status: derivePeriodStatus(persisted.total, persisted.standardSnapshot.minimum, nowMs, boundaries.endMs),
        progressPercent: persisted.progressPercent,
        isCurrentPeriod: false,
      });
    }
  }

  // Sort by periodEndMs desc (most recent first)
  merged.sort((a, b) => b.periodEndMs - a.periodEndMs);

  return merged;
}

/**
 * Recalculates period boundaries for historical documents using:
 * - Historical standard configuration (from when period was completed)
 * - Current calculation logic (with any bug fixes)
 */
export function recalculateHistoricalBoundaries(
  row: ActivityHistoryRow,
  timezone: string
): PeriodWindow {
  // Use referenceTimestampMs if available, otherwise fall back to periodStartMs
  const referenceTimestamp = row.referenceTimestampMs ?? row.periodStartMs;

  return calculatePeriodWindow(
    referenceTimestamp,
    row.standardSnapshot.cadence,
    timezone,
    { periodStartPreference: row.standardSnapshot.periodStartPreference }
  );
}

/**
 * Formats a total value for display.
 */
export function formatTotal(total: number): string {
  return numberFormatter.format(total);
}


