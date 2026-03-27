import { Standard, StandardCadence } from '@minimum-standards/shared-model';

/**
 * Filters Standards by search query using case-insensitive substring matching on summary string.
 */
export function filterStandardsBySearch(
  standards: Standard[],
  searchQuery: string
): Standard[] {
  if (!searchQuery.trim()) {
    return standards;
  }

  const query = searchQuery.toLowerCase();
  return standards.filter((standard) =>
    standard.summary.toLowerCase().includes(query)
  );
}

/**
 * Filters Standards by tab (Active or Archived).
 * Active: archivedAtMs === null && state === 'active'
 * Archived: archivedAtMs !== null || state === 'archived'
 */
export function filterStandardsByTab(
  standards: Standard[],
  tab: 'active' | 'archived'
): Standard[] {
  if (tab === 'active') {
    return standards.filter(
      (standard) =>
        standard.archivedAtMs === null && standard.state === 'active'
    );
  } else {
    return standards.filter(
      (standard) =>
        standard.archivedAtMs !== null || standard.state === 'archived'
    );
  }
}

/**
 * Sorts Standards alphabetically by summary string.
 */
export function sortStandardsBySummary(standards: Standard[]): Standard[] {
  return [...standards].sort((a, b) =>
    a.summary.localeCompare(b.summary)
  );
}

/**
 * Checks if two cadence objects are equal.
 */
function cadencesEqual(a: StandardCadence, b: StandardCadence): boolean {
  return a.interval === b.interval && a.unit === b.unit;
}

/**
 * Checks if form values match an existing Standard.
 * Match criteria: same name (case-insensitive), cadence, minimum, and unit.
 */
export function findMatchingStandard(
  standards: Standard[],
  name: string,
  cadence: StandardCadence,
  minimum: number,
  unit: string
): Standard | undefined {
  const normalizedName = name.toLowerCase();
  return standards.find(
    (standard) =>
      standard.name.toLowerCase() === normalizedName &&
      cadencesEqual(standard.cadence, cadence) &&
      standard.minimum === minimum &&
      standard.unit === unit
  );
}
