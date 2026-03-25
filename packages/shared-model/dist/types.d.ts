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
export type Activity = SoftDelete & AuditTimestamps & {
    id: string;
    name: string;
    unit: string;
    notes: string | null;
    categoryId: string | null;
};
export declare const UNCATEGORIZED_CATEGORY_ID: "uncategorized";
export type Category = SoftDelete & AuditTimestamps & {
    id: string;
    name: string;
    order: number;
    isSystem?: boolean;
};
export type Standard = SoftDelete & AuditTimestamps & {
    id: string;
    activityId: string;
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
    /** @deprecated Legacy field - READ-ONLY. Categories now belong to Activities. Use Activity.categoryId instead. */
    categoryId: string | null;
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
    activityId: string;
    standardId: string;
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
