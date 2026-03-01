import type { Activity, Standard } from '@minimum-standards/shared-model';
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

export interface ActivitySummaryCard {
  activityId: string;
  activityName: string;
  unit: string;
  totalVolume: number;
  totalVolumeFormatted: string;
  percentMet: number;
  metCount: number;
  completedCount: number;
  totalPeriods: number;
  countMetLabel: string;
}

/**
 * Builds per-activity summary cards from merged history rows.
 *
 * Groups rows by activityId, then for each activity computes:
 * - totalVolume: sum of row.total across all rows
 * - completedCount: rows where status !== 'In Progress'
 * - metCount: completed rows where status === 'Met'
 * - percentMet: metCount / completedCount * 100 (0 if no completed)
 */
export function buildActivitySummaryCards(params: {
  activities: Activity[];
  standards: Standard[];
  mergedRowsByActivity: Record<string, MergedActivityHistoryRow[]>;
  includeInactive: boolean;
}): ActivitySummaryCard[] {
  const { activities, standards, mergedRowsByActivity, includeInactive } = params;

  // Determine which activities are relevant based on their standards
  const activityHasActiveStandard = new Set<string>();
  const activityHasAnyStandard = new Set<string>();

  for (const standard of standards) {
    activityHasAnyStandard.add(standard.activityId);
    if (standard.state === 'active' && standard.archivedAtMs === null) {
      activityHasActiveStandard.add(standard.activityId);
    }
  }

  const relevantActivityIds = includeInactive
    ? activityHasAnyStandard
    : activityHasActiveStandard;

  const activityMap = new Map(activities.map((a) => [a.id, a]));

  const cards: ActivitySummaryCard[] = [];

  for (const activityId of relevantActivityIds) {
    const activity = activityMap.get(activityId);
    if (!activity) continue;

    const rows = mergedRowsByActivity[activityId] ?? [];
    const { completedCount, metCount, totalVolume } = aggregatePeriodStats(rows);

    const percentMet = completedCount > 0
      ? Math.round((metCount / completedCount) * 100)
      : 0;

    const totalPeriods = rows.length;

    cards.push({
      activityId,
      activityName: activity.name,
      unit: activity.unit,
      totalVolume,
      totalVolumeFormatted: formatTotal(totalVolume),
      percentMet,
      metCount,
      completedCount,
      totalPeriods,
      countMetLabel: `${metCount}/${completedCount} periods`,
    });
  }

  // Sort alphabetically by activity name
  cards.sort((a, b) => a.activityName.localeCompare(b.activityName));

  return cards;
}
