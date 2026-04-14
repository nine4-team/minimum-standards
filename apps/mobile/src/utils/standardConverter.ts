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
  quickAddValues?: number[];
  notes?: string | null;
  /** @deprecated Kept for migration compatibility */
  activityId?: string;
  archivedAt: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
  updatedAt: FirebaseFirestoreTypes.Timestamp | null;
  deletedAt: FirebaseFirestoreTypes.Timestamp | null;
  periodStartPreference?: Standard['periodStartPreference'];
  configEras?: ConfigEra[];
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
    quickAddValues: Array.isArray(data.quickAddValues)
      ? data.quickAddValues.filter(
          (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
        )
      : undefined,
    archivedAtMs: data.archivedAt?.toMillis() ?? null,
    createdAtMs: data.createdAt?.toMillis() ?? Date.now(),
    updatedAtMs: data.updatedAt?.toMillis() ?? Date.now(),
    deletedAtMs: data.deletedAt?.toMillis() ?? null,
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
