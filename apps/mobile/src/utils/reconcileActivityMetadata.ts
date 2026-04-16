import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';

const LAST_RECONCILE_KEY = 'lastActivityReconcileAtMs';

/**
 * Keeps standard.name / standard.notes in sync with the underlying activity
 * record for users still running a pre-Activity-elimination build (TestFlight).
 * Old clients write renames to `activities/{id}`; new clients read from
 * `standards/{id}`. The one-shot migration in migrateActivitiesToStandards
 * only copies once, so subsequent renames from old clients never reach the
 * standard. This runs on every authenticated app launch and reconciles
 * anything that changed since the last run.
 *
 * Safe to delete once the pre-elimination TestFlight build is retired.
 */
export async function reconcileActivityMetadata(userId: string): Promise<void> {
  const userDoc = doc(firebaseFirestore, 'users', userId);
  const migrationsRef = doc(collection(userDoc, 'preferences'), 'migrations');

  const markerSnap = await getDoc(migrationsRef);
  const markerData = (markerSnap.data() as Record<string, unknown> | undefined) ?? {};
  const lastReconcileAtMs =
    typeof markerData[LAST_RECONCILE_KEY] === 'number'
      ? (markerData[LAST_RECONCILE_KEY] as number)
      : 0;

  const activitiesQuery = query(
    collection(userDoc, 'activities'),
    where('updatedAt', '>', Timestamp.fromMillis(lastReconcileAtMs))
  );
  const activitiesSnap = await getDocs(activitiesQuery);
  if (activitiesSnap.empty) {
    return;
  }

  const activityUpdates = new Map<
    string,
    { name: string | null; notes: string | null }
  >();
  activitiesSnap.forEach((actDoc: any) => {
    const data = actDoc.data() ?? {};
    if (data.deletedAt) return;
    const name = typeof data.name === 'string' && data.name.trim().length > 0
      ? data.name
      : null;
    const notes = typeof data.notes === 'string' ? data.notes : null;
    if (name == null && notes == null) return;
    activityUpdates.set(actDoc.id, { name, notes });
  });

  if (activityUpdates.size === 0) {
    await migrationsRef.set(
      { [LAST_RECONCILE_KEY]: Date.now() },
      { merge: true }
    );
    return;
  }

  const standardsSnap = await getDocs(collection(userDoc, 'standards'));
  let reconciled = 0;
  const pending: Promise<void>[] = [];

  standardsSnap.forEach((stdDoc: any) => {
    const data = stdDoc.data() ?? {};
    const activityId = data.activityId;
    if (typeof activityId !== 'string') return;
    const updates = activityUpdates.get(activityId);
    if (!updates) return;

    const patch: Record<string, unknown> = {};
    if (
      updates.name !== null &&
      (typeof data.name !== 'string' || data.name !== updates.name)
    ) {
      patch.name = updates.name;
    }
    // Only overwrite notes when the activity has something non-null to offer,
    // so we don't clobber a standard-local note with activity's null.
    if (
      updates.notes !== null &&
      (typeof data.notes !== 'string' || data.notes !== updates.notes)
    ) {
      patch.notes = updates.notes;
    }

    if (Object.keys(patch).length === 0) return;

    patch.updatedAt = serverTimestamp();
    reconciled += 1;
    pending.push(
      stdDoc.ref
        .update(patch)
        .catch((err: any) => {
          console.error(
            `[reconcileActivityMetadata] Failed to update standard ${stdDoc.id}:`,
            err?.message ?? err
          );
        })
    );
  });

  await Promise.all(pending);

  if (reconciled > 0) {
    console.info(
      `[reconcileActivityMetadata] Reconciled ${reconciled} standard(s) from ${activityUpdates.size} changed activity record(s).`
    );
  }

  await migrationsRef.set(
    { [LAST_RECONCILE_KEY]: Date.now() },
    { merge: true }
  );
}
