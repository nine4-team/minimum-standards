import { Standard, ConfigEra, ActivityHistoryStandardSnapshot, TimestampMs } from './types';

/**
 * Returns the ConfigEra in effect at the given timestamp.
 *
 * Eras are sorted ascending by effectiveFromMs. The era returned is the last
 * one whose effectiveFromMs <= timestampMs. If the timestamp falls before the
 * first era, the first era is returned (it covers the standard's entire
 * lifetime back to creation). Returns null when the standard has no eras.
 */
export function resolveEraForTimestamp(
  standard: Standard,
  timestampMs: TimestampMs
): ConfigEra | null {
  if (!standard.configEras || standard.configEras.length === 0) {
    return null;
  }

  const sorted = [...standard.configEras].sort((a, b) => a.effectiveFromMs - b.effectiveFromMs);

  let result = sorted[0]; // default: earliest era covers everything before it
  for (const era of sorted) {
    if (era.effectiveFromMs <= timestampMs) {
      result = era;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Converts a ConfigEra into an ActivityHistoryStandardSnapshot.
 */
export function buildSnapshotFromEra(era: ConfigEra): ActivityHistoryStandardSnapshot {
  return {
    minimum: era.minimum,
    unit: era.unit,
    cadence: era.cadence,
    sessionConfig: era.sessionConfig,
    summary: era.summary,
    ...(era.periodStartPreference ? { periodStartPreference: era.periodStartPreference } : {}),
  };
}

/**
 * Converts the current Standard config into an ActivityHistoryStandardSnapshot.
 */
export function buildSnapshotFromStandard(standard: Standard): ActivityHistoryStandardSnapshot {
  return {
    minimum: standard.minimum,
    unit: standard.unit,
    cadence: standard.cadence,
    sessionConfig: standard.sessionConfig,
    summary: standard.summary,
    ...(standard.periodStartPreference
      ? { periodStartPreference: standard.periodStartPreference }
      : {}),
  };
}
