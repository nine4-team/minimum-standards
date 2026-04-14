export type TimestampMs = number;
export type CadenceUnit = 'day' | 'week' | 'month';
export type StandardCadence = {
    interval: number;
    unit: CadenceUnit;
};
export type StandardState = 'active' | 'archived';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PeriodStartPreference = {
    mode: 'default';
} | {
    mode: 'weekDay';
    weekStartDay: Weekday;
};
export declare const DEFAULT_PERIOD_START_PREFERENCE: PeriodStartPreference;
export type StandardSessionConfig = {
    sessionLabel: string;
    sessionsPerCadence: number;
    volumePerSession: number;
};
export type SoftDelete = {
    deletedAtMs: TimestampMs | null;
};
export type AuditTimestamps = {
    createdAtMs: TimestampMs;
    updatedAtMs: TimestampMs;
};
/** @deprecated Activities have been merged into Standards. Kept for migration only. */
export type Activity = SoftDelete & AuditTimestamps & {
    id: string;
    name: string;
    unit: string;
    notes: string | null;
};
export type Standard = SoftDelete & AuditTimestamps & {
    id: string;
    name: string;
    minimum: number;
    unit: string;
    cadence: StandardCadence;
    state: StandardState;
    summary: string;
    archivedAtMs: TimestampMs | null;
    quickAddValues?: number[];
    sessionConfig: StandardSessionConfig;
    periodStartPreference?: PeriodStartPreference;
    configEras?: ConfigEra[];
    notes: string | null;
    /** @deprecated Kept for migration compatibility. Will be removed in a future release. */
    activityId?: string;
};
export type ActivityLog = SoftDelete & AuditTimestamps & {
    id: string;
    standardId: string;
    value: number;
    occurredAtMs: TimestampMs;
    note: string | null;
    editedAtMs: TimestampMs | null;
};
export type DashboardPins = {
    id: string;
    pinnedStandardIds: string[];
    updatedAtMs: TimestampMs;
};
export type ActivityHistorySource = 'boundary' | 'resume' | 'log-edit';
export type ConfigEra = {
    effectiveFromMs: TimestampMs;
    minimum: number;
    unit: string;
    cadence: StandardCadence;
    sessionConfig: StandardSessionConfig;
    summary: string;
    periodStartPreference?: PeriodStartPreference;
};
export type ActivityHistoryStandardSnapshot = {
    minimum: number;
    unit: string;
    cadence: StandardCadence;
    sessionConfig: StandardSessionConfig;
    summary?: string;
    periodStartPreference?: PeriodStartPreference;
};
export type ActivityHistoryPeriodStatus = 'Met' | 'In Progress' | 'Missed';
export type ActivityHistoryDoc = {
    id: string;
    standardId: string;
    /** @deprecated Kept for migration compatibility. */
    activityId?: string;
    referenceTimestampMs: TimestampMs;
    standardSnapshot: ActivityHistoryStandardSnapshot;
    total: number;
    currentSessions: number;
    targetSessions: number;
    status: ActivityHistoryPeriodStatus;
    progressPercent: number;
    generatedAtMs: TimestampMs;
    source: ActivityHistorySource;
    deletedAtMs?: TimestampMs | null;
    periodStartMs?: TimestampMs;
    periodEndMs?: TimestampMs;
    periodLabel?: string;
    periodKey?: string;
};
