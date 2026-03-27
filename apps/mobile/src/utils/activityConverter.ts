import { Activity, activitySchema } from '@minimum-standards/shared-model';
import { FirebaseFirestoreTypes, serverTimestamp, Timestamp } from '@react-native-firebase/firestore';

/**
 * @deprecated Activity entity is being removed. Standards now have name/notes/categoryId directly.
 * Kept for migration compatibility with existing Activity documents in Firestore.
 *
 * Converts a React Native Firebase Firestore document to an Activity model.
 */
export function fromFirestoreActivity(
  docId: string,
  data: FirestoreActivityData
): Activity {
  return activitySchema.parse({
    id: docId,
    name: data.name,
    unit: data.unit,
    notes: data.notes,
    categoryId: data.categoryId ?? null,
    createdAtMs: data.createdAt?.toMillis() ?? Date.now(),
    updatedAtMs: data.updatedAt?.toMillis() ?? Date.now(),
    deletedAtMs: data.deletedAt?.toMillis() ?? null,
  });
}

/**
 * Converts an Activity model to Firestore data format for React Native Firebase.
 * Note: createdAt and updatedAt should use serverTimestamp() when writing.
 */
export function toFirestoreActivity(
  activity: Omit<Activity, 'id' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'>
): Omit<FirestoreActivityData, 'createdAt' | 'updatedAt'> & {
  createdAt: FirebaseFirestoreTypes.FieldValue;
  updatedAt: FirebaseFirestoreTypes.FieldValue;
  deletedAt: FirebaseFirestoreTypes.Timestamp | null;
} {
  return {
    name: activity.name,
    unit: activity.unit, // Already normalized via schema transform
    notes: activity.notes ?? null,
    categoryId: activity.categoryId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  };
}

/**
 * Converts Activity updates to Firestore update format.
 */
export function toFirestoreActivityUpdate(
  updates: Partial<Omit<Activity, 'id' | 'createdAtMs' | 'updatedAtMs' | 'deletedAtMs'>>
): Partial<FirestoreActivityData> & {
  updatedAt: FirebaseFirestoreTypes.FieldValue;
} {
  const result: any = {
    updatedAt: serverTimestamp(),
  };

  if (updates.name !== undefined) {
    result.name = updates.name;
  }
  if (updates.unit !== undefined) {
    result.unit = updates.unit;
  }
  if (updates.notes !== undefined) {
    result.notes = updates.notes;
  }
  if (updates.categoryId !== undefined) {
    result.categoryId = updates.categoryId ?? null;
  }

  return result;
}

/**
 * Converts Activity soft delete to Firestore update format.
 */
export function toFirestoreActivityDelete(): {
  deletedAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.FieldValue;
} {
  return {
    deletedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  };
}
