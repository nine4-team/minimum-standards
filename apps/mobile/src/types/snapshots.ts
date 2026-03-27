import type {
  PeriodStartPreference,
  StandardCadence,
  StandardSessionConfig,
} from '@minimum-standards/shared-model';

export type SnapshotCategory = {
  id: string;
  name: string;
  order: number;
  isSystem?: boolean;
};

export type SnapshotActivity = {
  id: string;
  name: string;
  unit: string;
  notes: string | null;
  categoryId: string | null;
};

/** v1 standard (references activityId) */
export type SnapshotStandard = {
  id: string;
  activityId: string;
  minimum: number;
  unit: string;
  cadence: StandardCadence;
  sessionConfig: StandardSessionConfig;
  periodStartPreference?: PeriodStartPreference;
};

/** v2 standard (name/notes/categoryId inline, no activityId) */
export type SnapshotStandardV2 = {
  id: string;
  name: string;
  notes: string | null;
  categoryId: string | null;
  minimum: number;
  unit: string;
  cadence: StandardCadence;
  sessionConfig: StandardSessionConfig;
  periodStartPreference?: PeriodStartPreference;
};

/** v1 payload (with activities[]) */
export type SnapshotPayload = {
  categories: SnapshotCategory[];
  activities: SnapshotActivity[];
  standards: SnapshotStandard[];
};

/** v2 payload (no activities[], standards have name/notes/categoryId inline) */
export type SnapshotPayloadV2 = {
  version: 2;
  categories: SnapshotCategory[];
  standards: SnapshotStandardV2[];
};

export type AnySnapshotPayload = SnapshotPayload | SnapshotPayloadV2;

export type SnapshotRecord = {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  version: number;
  isEnabled: boolean;
  payload: AnySnapshotPayload;
  createdAtMs: number;
  updatedAtMs: number;
  deletedAtMs: number | null;
};

export type ShareLinkRecord = {
  id: string;
  shareCode: string;
  snapshotId: string;
  ownerUserId: string;
  createdAtMs: number;
  updatedAtMs: number;
  disabledAtMs: number | null;
};

export type SnapshotInstallRecord = {
  id: string;
  snapshotId: string;
  ownerUserId: string;
  installedAtMs: number;
};
