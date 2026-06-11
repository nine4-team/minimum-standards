import { FirebaseFirestoreTypes, serverTimestamp, Timestamp } from '@react-native-firebase/firestore';
import { Standard, ConfigEra, standardSchema } from '@minimum-standards/shared-model';

export type FirestoreStandardData = {
  name: string;
  minimum: number;
  unit: string;
  cadence: Standard['cadence'];
  state: Standard['state'];
  summary: string;
  sessionConfig: Standard['sessionConfig'];
  defaultQuantity?: number;
  notes?: string | null;
  categoryId?: string;
  /** @deprecated Kept for migration compatibility */
  activityId?: string;
  archivedAt: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
  updatedAt: FirebaseFirestoreTypes.Timestamp | null;
  deletedAt: FirebaseFirestoreTypes.Timestamp | null;
  periodStartPreference?: Standard['periodStartPreference'];
  configEras?: ConfigEra[];
  orderIndex?: number;
  dashboardPageId?: string;
  dashboardOrderIndex?: number;
  hiddenFromGroup?: boolean;
};

/**
 * Converts a Firestore document (React Native Firebase) into a Standard model
 * using the shared Zod schema for validation/parity.
 */
export function fromFirestoreStandard(
  docId: string,
  data: FirestoreStandardData
): Standard {
  if (!data) {
    throw new Error(`Missing data for standard ${docId}`);
  }

  return standardSchema.parse({
    id: docId,
    name: data.name,
    notes: data.notes ?? null,
    ...(data.activityId ? { activityId: data.activityId } : {}),
    minimum: data.minimum,
    unit: data.unit,
    cadence: data.cadence,
    state: data.state,
    summary: data.summary,
    sessionConfig: data.sessionConfig,
    periodStartPreference: data.periodStartPreference,
    configEras: Array.isArray(data.configEras) ? data.configEras : undefined,
    defaultQuantity:
      typeof data.defaultQuantity === 'number' &&
      Number.isFinite(data.defaultQuantity) &&
      data.defaultQuantity > 0
        ? data.defaultQuantity
        : undefined,
    archivedAtMs: data.archivedAt?.toMillis() ?? null,
    createdAtMs: data.createdAt?.toMillis() ?? Date.now(),
    updatedAtMs: data.updatedAt?.toMillis() ?? Date.now(),
    deletedAtMs: data.deletedAt?.toMillis() ?? null,
    orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : undefined,
    dashboardPageId:
      typeof data.dashboardPageId === 'string' && data.dashboardPageId.length > 0
        ? data.dashboardPageId
        : undefined,
    dashboardOrderIndex:
      typeof data.dashboardOrderIndex === 'number'
        ? data.dashboardOrderIndex
        : undefined,
    hiddenFromGroup: data.hiddenFromGroup === true ? true : undefined,
  }) as Standard;
}

/**
 * Converts Standard soft delete to Firestore update format.
 */
export function toFirestoreStandardDelete(): {
  deletedAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.FieldValue;
} {
  return {
    deletedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  };
}

export function toFirestoreStandardArchiveState(
  data: FirestoreStandardData,
  shouldArchive: boolean,
  timestamp: FirebaseFirestoreTypes.FieldValue = serverTimestamp()
): Record<string, unknown> {
  return {
    ...(typeof data.name === 'string' ? { name: data.name } : {}),
    minimum: data.minimum,
    unit: data.unit,
    cadence: data.cadence,
    state: shouldArchive ? 'archived' : 'active',
    summary: data.summary,
    sessionConfig: data.sessionConfig,
    ...(data.periodStartPreference
      ? { periodStartPreference: data.periodStartPreference }
      : {}),
    ...(typeof data.defaultQuantity === 'number' && data.defaultQuantity > 0
      ? { defaultQuantity: data.defaultQuantity }
      : {}),
    ...(typeof data.notes === 'string' || data.notes === null
      ? { notes: data.notes }
      : {}),
    ...(typeof data.categoryId === 'string' ? { categoryId: data.categoryId } : {}),
    ...(typeof data.activityId === 'string' ? { activityId: data.activityId } : {}),
    archivedAt: shouldArchive ? timestamp : null,
    createdAt: data.createdAt,
    updatedAt: timestamp,
    deletedAt: data.deletedAt ?? null,
    ...(Array.isArray(data.configEras) ? { configEras: data.configEras } : {}),
    ...(typeof data.orderIndex === 'number' ? { orderIndex: data.orderIndex } : {}),
    ...(typeof data.dashboardPageId === 'string' && data.dashboardPageId.length > 0
      ? { dashboardPageId: data.dashboardPageId }
      : {}),
    ...(typeof data.dashboardOrderIndex === 'number'
      ? { dashboardOrderIndex: data.dashboardOrderIndex }
      : {}),
    ...(data.hiddenFromGroup === true ? { hiddenFromGroup: true } : {}),
  };
}
