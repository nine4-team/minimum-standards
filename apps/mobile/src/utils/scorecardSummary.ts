import type { Standard } from '@minimum-standards/shared-model';
import type { MergedActivityHistoryRow } from './activityHistory';
import { formatTotal } from './activityHistory';

/**
 * Aggregates period stats from rows. Each row = one period.
 * completedCount excludes In Progress rows.
 * metCount counts only Met rows among completed.
 */
export function aggregatePeriodStats(rows: MergedActivityHistoryRow[]): {
  completedCount: number;
  metCount: number;
  totalVolume: number;
} {
  let totalVolume = 0;
  let metCount = 0;
  let completedCount = 0;

  for (const row of rows) {
    totalVolume += row.total;
    if (row.status !== 'In Progress') {
      completedCount += 1;
      if (row.status === 'Met') {
        metCount += 1;
      }
    }
  }

  return { completedCount, metCount, totalVolume };
}

export interface StandardSummaryCard {
  standardId: string;
  standardName: string;
  unit: string;
  totalVolume: number;
  totalVolumeFormatted: string;
  percentMet: number;
  metCount: number;
  completedCount: number;
  totalPeriods: number;
  countMetLabel: string;
  isActive: boolean;
}

/**
 * Builds per-standard summary cards from merged history rows.
 *
 * Groups rows by standardId, then for each standard computes:
 * - totalVolume: sum of row.total across all rows
 * - completedCount: rows where status !== 'In Progress'
 * - metCount: completed rows where status === 'Met'
 * - percentMet: metCount / completedCount * 100 (0 if no completed)
 */
export function buildStandardSummaryCards(params: {
  standards: Standard[];
  mergedRowsByStandard: Record<string, MergedActivityHistoryRow[]>;
  includeInactive: boolean;
}): StandardSummaryCard[] {
  const { standards, mergedRowsByStandard, includeInactive } = params;

  const relevantStandards = includeInactive
    ? standards
    : standards.filter(
        (standard) => standard.state === 'active' && standard.archivedAtMs === null
      );

  const cards: StandardSummaryCard[] = [];

  for (const standard of relevantStandards) {
    const rows = mergedRowsByStandard[standard.id] ?? [];
    const { completedCount, metCount, totalVolume } = aggregatePeriodStats(rows);

    const percentMet = completedCount > 0
      ? Math.round((metCount / completedCount) * 100)
      : 0;

    const totalPeriods = rows.length;

    const isActive = standard.state === 'active' && standard.archivedAtMs === null;

    cards.push({
      standardId: standard.id,
      standardName: standard.name,
      unit: standard.unit,
      totalVolume,
      totalVolumeFormatted: formatTotal(totalVolume),
      percentMet,
      metCount,
      completedCount,
      totalPeriods,
      countMetLabel: `${metCount}/${completedCount} periods`,
      isActive,
    });
  }

  // Active first, then alphabetically within each group
  cards.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.standardName.localeCompare(b.standardName);
  });

  return cards;
}
