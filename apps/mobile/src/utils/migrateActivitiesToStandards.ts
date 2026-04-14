import {
  collection,
  doc,
  getDocs,
  writeBatch,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';

const MIGRATION_KEY = 'activitiesFlattened';

/**
 * One-time migration: copies Activity fields (name, notes) onto
 * each Standard, then rewrites ActivityHistory doc IDs from the old
 * `activityId__standardId__periodStartMs` format to `standardId__periodStartMs`.
 *
 * Idempotent — skips if the migration marker already exists.
 */
export async function migrateActivitiesToStandards(userId: string): Promise<boolean> {
  const userDoc = doc(firebaseFirestore, 'users', userId);
  const migrationsRef = doc(collection(userDoc, 'preferences'), 'migrations');

  // Check migration marker
  console.info('[Migration] Checking migration marker...');
  const markerSnap = await getDoc(migrationsRef);
  const markerData = markerSnap.data() as Record<string, unknown> | undefined;
  const markerExists = typeof markerSnap.exists === 'function'
    ? (markerSnap as any).exists()
    : markerSnap.exists;
  if (markerExists && markerData?.[MIGRATION_KEY]) {
    console.info('[Migration] Already migrated, skipping');
    return false;
  }

  // Read all activities (including soft-deleted)
  const activitiesSnap = await getDocs(collection(userDoc, 'activities'));
  const activityMap = new Map<string, { name: string; notes: string | null }>();
  activitiesSnap.forEach((actDoc: any) => {
    const data = actDoc.data();
    activityMap.set(actDoc.id, {
      name: data.name ?? '',
      notes: data.notes ?? null,
    });
  });

  console.info(`[Migration] Found ${activityMap.size} activities`);

  // If no activities exist, just set marker and return
  if (activityMap.size === 0) {
    await setDoc(migrationsRef, { [MIGRATION_KEY]: true, migratedAtMs: Date.now() }, { merge: true });
    return true;
  }

  // Read all standards and update those missing `name`
  const standardsSnap = await getDocs(collection(userDoc, 'standards'));
  console.info(`[Migration] Found ${standardsSnap.size} standards`);
  let batchCount = 0;

  // Use individual updates instead of batch to get better error reporting
  const updatePromises: Promise<void>[] = [];
  standardsSnap.forEach((stdDoc: any) => {
    const data = stdDoc.data();
    // Only migrate if standard doesn't have name yet
    if (data.name) return;

    const activityId = data.activityId;
    if (!activityId) return;

    const activity = activityMap.get(activityId);
    if (!activity) {
      console.warn(`[Migration] No activity found for activityId ${activityId}`);
      return;
    }

    console.info(`[Migration] Updating standard ${stdDoc.id} with name "${activity.name}"`);
    updatePromises.push(
      stdDoc.ref.update({
        name: activity.name,
        notes: activity.notes,
        updatedAt: serverTimestamp(),
      }).catch((err: any) => {
        console.error(`[Migration] Failed to update standard ${stdDoc.id}:`, err?.message ?? err);
      })
    );
    batchCount++;
  });

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
    console.info(`[Migration] Updated ${batchCount} standards`);
  }

  // Rewrite ActivityHistory doc IDs: old format activityId__standardId__periodStartMs → standardId__periodStartMs
  const historySnap = await getDocs(collection(userDoc, 'activityHistory'));
  console.info(`[Migration] Found ${historySnap.size} history docs`);
  let historyBatchCount = 0;
  const historyCollection = collection(userDoc, 'activityHistory');
  const historyPromises: Promise<void>[] = [];

  historySnap.forEach((histDoc: any) => {
    const data = histDoc.data();
    const parts = histDoc.id.split('__');

    // Only rewrite docs with old 3-segment ID format
    if (parts.length !== 3) return;

    const [, standardId, periodStartMs] = parts;
    const newId = `${standardId}__${periodStartMs}`;

    if (newId === histDoc.id) return;

    // Write new doc (without activityId), then delete old
    const { activityId: _removed, ...rest } = data;
    const newDocRef = doc(historyCollection, newId);

    historyPromises.push(
      setDoc(newDocRef, { ...rest, id: newId })
        .then(() => histDoc.ref.delete())
        .catch((err: any) => {
          console.error(`[Migration] Failed to rewrite history ${histDoc.id}:`, err?.message ?? err);
        })
    );
    historyBatchCount++;
  });

  if (historyPromises.length > 0) {
    await Promise.all(historyPromises);
    console.info(`[Migration] Rewrote ${historyBatchCount} history docs`);
  }

  // Set migration marker
  await setDoc(migrationsRef, { [MIGRATION_KEY]: true, migratedAtMs: Date.now() }, { merge: true });

  console.info(`[Migration] Complete! ${batchCount} standards, ${historyBatchCount} history docs`);
  return true;
}
