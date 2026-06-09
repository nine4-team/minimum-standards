export type TimestampMs = number;

export type CadenceUnit = 'day' | 'week' | 'month';
export type StandardCadence = {
  interval: number;
  unit: CadenceUnit;
};
export type StandardState = 'active' | 'archived';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PeriodStartPreference =
  | { mode: 'default' }
  | {
      mode: 'weekDay';
      weekStartDay: Weekday;
    };

export const DEFAULT_PERIOD_START_PREFERENCE: PeriodStartPreference = { mode: 'default' };

export type StandardSessionConfig = {
  sessionLabel: string; // User-friendly label for the "count" dimension (e.g., "session", "run", "workout")
  sessionsPerCadence: number; // e.g., 5 sessions per week
  volumePerSession: number; // e.g., 15 minutes per session
};

export type SoftDelete = {
  deletedAtMs: TimestampMs | null;
};

export type AuditTimestamps = {
  createdAtMs: TimestampMs;
  updatedAtMs: TimestampMs;
};

/** @deprecated Activities have been merged into Standards. Kept for migration only. */
export type Activity = SoftDelete &
  AuditTimestamps & {
    id: string;
    name: string;
    unit: string;
    notes: string | null;
  };

export type Standard = SoftDelete &
  AuditTimestamps & {
    id: string;
    name: string;
    minimum: number; // Always calculated from sessionConfig: sessionsPerCadence × volumePerSession
    unit: string;
    cadence: StandardCadence;
    state: StandardState;
    summary: string; // Normalized summary string like "1000 calls / week" or "5 sessions × 15 minutes = 75 minutes / week"
    archivedAtMs: TimestampMs | null; // Timestamp when archived, null if active
    defaultQuantity?: number; // Optional default quantity used by the dashboard quick-log chip
    sessionConfig: StandardSessionConfig; // Required: session-based configuration
    periodStartPreference?: PeriodStartPreference;
    configEras?: ConfigEra[];
    notes: string | null;
    orderIndex?: number;
    dashboardPageId?: string;
    dashboardOrderIndex?: number;
    hiddenFromGroup?: boolean;
    /** @deprecated Kept for migration compatibility. Will be removed in a future release. */
    activityId?: string;
  };

export type ActivityLog = SoftDelete &
  AuditTimestamps & {
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

export type DashboardLayoutPage = {
  id: string;
  name: string;
  orderIndex: number;
};

export type DashboardLayout = {
  id: string;
  pages: DashboardLayoutPage[];
  pageSize: 6;
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
  referenceTimestampMs: TimestampMs; // Durable reference used for boundary recalculation
  standardSnapshot: ActivityHistoryStandardSnapshot;
  total: number;
  currentSessions: number;
  targetSessions: number;
  status: ActivityHistoryPeriodStatus;
  progressPercent: number;
  generatedAtMs: TimestampMs;
  source: ActivityHistorySource;
  deletedAtMs?: TimestampMs | null;
  // Legacy snapshot fields retained for backwards compatibility; derived in UI going forward.
  periodStartMs?: TimestampMs;
  periodEndMs?: TimestampMs;
  periodLabel?: string;
  periodKey?: string;
};
