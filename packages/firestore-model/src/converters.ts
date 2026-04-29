import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { z } from 'zod';
import {
  Activity,
  ActivityLog,
  Standard,
  Category,
  ActivityHistoryDoc,
  ActivityHistoryStandardSnapshot,
  PeriodStartPreference,
  Weekday,
  activityLogSchema,
  activitySchema,
  standardSchema,
  categorySchema,
  activityHistoryDocSchema,
  formatStandardSummary,
  DashboardPins,
  dashboardPinsSchema
} from '@minimum-standards/shared-model';
import { msToTimestamp, timestampToMs } from './timestamps';

type FirestoreActivity = Omit<Activity, 'id' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'> & {
  notes: string | null;
  categoryId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
};

type FirestoreStandard = Omit<Standard, 'id' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs' | 'archivedAtMs' | 'activityId'> & {
  sessionConfig: Standard['sessionConfig'];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  periodStartPreference?: Standard['periodStartPreference'];
  categoryId?: string | null;
  activityId?: string; // Deprecated: kept for migration reads
};

type FirestoreCategory = Omit<Category, 'id' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
};

type FirestoreActivityLog = Omit<
  ActivityLog,
  'id' | 'createdAtMs' | 'updatedAtMs' | 'editedAtMs' | 'deletedAtMs' | 'occurredAtMs'
> & {
  occurredAt: Timestamp;
  note: string | null;
  editedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
};

type FirestoreDashboardPins = {
  pinnedStandardIds: string[];
  updatedAt: Timestamp | null;
};

function coercePeriodStartPreference(
  preference: unknown
): PeriodStartPreference | undefined {
  if (!preference || typeof preference !== 'object') {
    return undefined;
  }

  const maybePreference = preference as {
    mode?: string;
    weekStartDay?: unknown;
  };

  if (maybePreference.mode === 'default') {
    return { mode: 'default' };
  }

  if (
    maybePreference.mode === 'weekDay' &&
    typeof maybePreference.weekStartDay === 'number'
  ) {
    const weekStartDay = maybePreference.weekStartDay;
    if (weekStartDay >= 1 && weekStartDay <= 7) {
      return {
        mode: 'weekDay',
        weekStartDay: weekStartDay as Weekday,
      };
    }
  }

  return undefined;
}

function parseWith<T>(schema: z.ZodTypeAny, value: unknown): T {
  return schema.parse(value) as T;
}

export const activityConverter: FirestoreDataConverter<Activity> = {
  toFirestore(model: Activity) {
    // Note: createdAt/updatedAt should be server-controlled; on write we use serverTimestamp().
    // Note: unit should already be normalized to plural form via activitySchema transform.
    return {
      name: model.name,
      unit: model.unit, // Already normalized via schema transform
      notes: model.notes,
      categoryId: model.categoryId ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: model.deletedAtMs == null ? null : msToTimestamp(model.deletedAtMs)
    } as unknown as FirestoreActivity;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Activity {
    const data = snapshot.data(options) as FirestoreActivity;

    const parsed = parseWith<Activity>(activitySchema, {
      id: snapshot.id,
      name: data.name,
      unit: data.unit,
      notes: data.notes ?? null,
      categoryId: data.categoryId ?? null,
      createdAtMs: timestampToMs(data.createdAt),
      updatedAtMs: timestampToMs(data.updatedAt),
      deletedAtMs: data.deletedAt == null ? null : timestampToMs(data.deletedAt)
    });

    return {
      ...parsed,
      notes: parsed.notes ?? null,
    };
  }
};

export const standardConverter: FirestoreDataConverter<Standard> = {
  toFirestore(model: Standard) {
    // Ensure summary is regenerated if cadence/minimum/unit/sessionConfig changed
    const summary = formatStandardSummary(model.minimum, model.unit, model.cadence, model.sessionConfig);

    return {
      name: model.name,
      minimum: model.minimum,
      unit: model.unit,
      cadence: model.cadence,
      state: model.state,
      summary: summary,
      sessionConfig: model.sessionConfig,
      notes: model.notes ?? null,
      ...(model.periodStartPreference && model.periodStartPreference.mode !== 'default'
        ? { periodStartPreference: model.periodStartPreference }
        : {}),
      ...(typeof model.defaultQuantity === 'number' && model.defaultQuantity > 0
        ? { defaultQuantity: model.defaultQuantity }
        : {}),
      ...(model.categoryId != null ? { categoryId: model.categoryId } : {}),
      archivedAt: model.archivedAtMs == null ? null : msToTimestamp(model.archivedAtMs),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: model.deletedAtMs == null ? null : msToTimestamp(model.deletedAtMs)
    } as unknown as FirestoreStandard;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Standard {
    const data = snapshot.data(options) as FirestoreStandard;

    const rawStandard: Record<string, unknown> = {
      id: snapshot.id,
      name: (data as any).name ?? '', // May be empty for pre-migration docs
      minimum: data.minimum,
      unit: data.unit,
      cadence: data.cadence,
      state: data.state,
      summary: data.summary,
      sessionConfig: data.sessionConfig,
      notes: (data as any).notes ?? null,
      periodStartPreference: coercePeriodStartPreference(data.periodStartPreference),
      defaultQuantity:
        typeof (data as any).defaultQuantity === 'number' &&
        Number.isFinite((data as any).defaultQuantity) &&
        (data as any).defaultQuantity > 0
          ? ((data as any).defaultQuantity as number)
          : undefined,
      categoryId: (data as any).categoryId ?? null,
      // Preserve activityId if present (migration compat)
      ...(data.activityId ? { activityId: data.activityId } : {}),
      archivedAtMs: data.archivedAt == null ? null : timestampToMs(data.archivedAt),
      createdAtMs: timestampToMs(data.createdAt),
      updatedAtMs: timestampToMs(data.updatedAt),
      deletedAtMs: data.deletedAt == null ? null : timestampToMs(data.deletedAt)
    };

    return parseWith<Standard>(standardSchema, rawStandard);
  }
};

export const categoryConverter: FirestoreDataConverter<Category> = {
  toFirestore(model: Category) {
    return {
      name: model.name,
      order: model.order,
      isSystem: model.isSystem ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: model.deletedAtMs == null ? null : msToTimestamp(model.deletedAtMs)
    } as unknown as FirestoreCategory;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Category {
    const data = snapshot.data(options) as FirestoreCategory;

    return parseWith<Category>(categorySchema, {
      id: snapshot.id,
      name: data.name,
      order: data.order,
      isSystem: data.isSystem ?? false,
      createdAtMs: timestampToMs(data.createdAt),
      updatedAtMs: timestampToMs(data.updatedAt),
      deletedAtMs: data.deletedAt == null ? null : timestampToMs(data.deletedAt)
    });
  }
};

export const activityLogConverter: FirestoreDataConverter<ActivityLog> = {
  toFirestore(model: ActivityLog) {
    return {
      standardId: model.standardId,
      value: model.value,
      occurredAt: msToTimestamp(model.occurredAtMs),
      note: model.note,
      editedAt: model.editedAtMs == null ? null : msToTimestamp(model.editedAtMs),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: model.deletedAtMs == null ? null : msToTimestamp(model.deletedAtMs)
    } as unknown as FirestoreActivityLog;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): ActivityLog {
    const data = snapshot.data(options) as FirestoreActivityLog;

    return parseWith<ActivityLog>(activityLogSchema, {
      id: snapshot.id,
      standardId: data.standardId,
      value: data.value,
      occurredAtMs: timestampToMs(data.occurredAt),
      note: data.note ?? null,
      editedAtMs: data.editedAt == null ? null : timestampToMs(data.editedAt),
      createdAtMs: timestampToMs(data.createdAt),
      updatedAtMs: timestampToMs(data.updatedAt),
      deletedAtMs: data.deletedAt == null ? null : timestampToMs(data.deletedAt)
    });
  }
};

export const dashboardPinsConverter: FirestoreDataConverter<DashboardPins> = {
  toFirestore(model: DashboardPins) {
    return {
      pinnedStandardIds: model.pinnedStandardIds,
      updatedAt: serverTimestamp()
    } as unknown as FirestoreDashboardPins;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): DashboardPins {
    const data = snapshot.data(options) as FirestoreDashboardPins;
    return parseWith<DashboardPins>(dashboardPinsSchema, {
      id: snapshot.id,
      pinnedStandardIds: Array.isArray(data.pinnedStandardIds)
        ? data.pinnedStandardIds
        : [],
      updatedAtMs:
        data.updatedAt == null ? Date.now() : timestampToMs(data.updatedAt)
    });
  }
};

// ActivityHistory stores timestamps as numbers (ms), not Firestore Timestamps
type FirestoreActivityHistoryDoc = Omit<ActivityHistoryDoc, 'id'>;

export const activityHistoryConverter: FirestoreDataConverter<ActivityHistoryDoc> = {
  toFirestore(model: ActivityHistoryDoc) {
    // Note: All timestamps are stored as numbers (ms) per spec
    return {
      standardId: model.standardId,
      referenceTimestampMs: model.referenceTimestampMs,
      standardSnapshot: model.standardSnapshot,
      total: model.total,
      currentSessions: model.currentSessions,
      targetSessions: model.targetSessions,
      status: model.status,
      progressPercent: model.progressPercent,
      generatedAtMs: model.generatedAtMs,
      source: model.source,
    } as unknown as FirestoreActivityHistoryDoc;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): ActivityHistoryDoc {
    const data = snapshot.data(options) as FirestoreActivityHistoryDoc;
    const referenceTimestampMs =
      typeof data.referenceTimestampMs === 'number'
        ? data.referenceTimestampMs
        : data.periodStartMs;

    if (typeof referenceTimestampMs !== 'number') {
      throw new Error('[activityHistoryConverter] Document missing reference timestamp');
    }

    const normalizedSnapshot: ActivityHistoryStandardSnapshot = {
      ...data.standardSnapshot,
      periodStartPreference: coercePeriodStartPreference(
        data.standardSnapshot?.periodStartPreference
      ),
    };

    const rawHistoryDoc: Record<string, unknown> = {
      id: snapshot.id,
      standardId: data.standardId,
      // Preserve activityId if present (legacy docs)
      ...(data.activityId ? { activityId: data.activityId } : {}),
      referenceTimestampMs,
      periodStartMs: data.periodStartMs,
      periodEndMs: data.periodEndMs,
      periodLabel: data.periodLabel,
      periodKey: data.periodKey,
      standardSnapshot: normalizedSnapshot,
      total: data.total,
      currentSessions: data.currentSessions,
      targetSessions: data.targetSessions,
      status: data.status,
      progressPercent: data.progressPercent,
      generatedAtMs: data.generatedAtMs,
      source: data.source,
    };

    return parseWith<ActivityHistoryDoc>(activityHistoryDocSchema, rawHistoryDoc);
  }
};
