import { Activity, Standard } from '@minimum-standards/shared-model';

/**
 * @deprecated Activity entity is being removed. Standards now have name/notes/categoryId directly.
 * This file is no longer used and can be safely deleted.
 *
 * Filters Activities by tab (Active or Inactive).
 * Active: activities that are referenced by at least one active standard
 * Inactive: activities that are not referenced by any active standard
 */
export function filterActivitiesByTab(
  activities: Activity[],
  activeStandards: Standard[],
  tab: 'active' | 'inactive'
): Activity[] {
  // Create a set of activity IDs that are referenced by active standards
  const activeActivityIds = new Set<string>();
  activeStandards.forEach((standard) => {
    if (standard.archivedAtMs === null && standard.state === 'active') {
      activeActivityIds.add(standard.activityId);
    }
  });

  if (tab === 'active') {
    return activities.filter((activity) => activeActivityIds.has(activity.id));
  } else {
    return activities.filter((activity) => !activeActivityIds.has(activity.id));
  }
}
