import { Standard, ConfigEra, ActivityHistoryStandardSnapshot, TimestampMs } from './types';
/**
 * Returns the ConfigEra in effect at the given timestamp.
 *
 * Eras are sorted ascending by effectiveFromMs. The era returned is the last
 * one whose effectiveFromMs <= timestampMs. If the timestamp falls before the
 * first era, the first era is returned (it covers the standard's entire
 * lifetime back to creation). Returns null when the standard has no eras.
 */
export declare function resolveEraForTimestamp(standard: Standard, timestampMs: TimestampMs): ConfigEra | null;
/**
 * Converts a ConfigEra into an ActivityHistoryStandardSnapshot.
 */
export declare function buildSnapshotFromEra(era: ConfigEra): ActivityHistoryStandardSnapshot;
/**
 * Converts the current Standard config into an ActivityHistoryStandardSnapshot.
 */
export declare function buildSnapshotFromStandard(standard: Standard): ActivityHistoryStandardSnapshot;
