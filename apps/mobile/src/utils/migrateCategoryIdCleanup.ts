import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';

const MIGRATION_KEY = 'categoryIdRemoved';

/**
 * One-time migration: removes the deprecated `categoryId` field from all
 * standard and activity documents. This field was removed from the app
 * in the "remove categories" simplification but existing Firestore docs
 * still carry it, causing security rules to reject updates.
 *
 * Idempotent — skips if the migration marker already exists.
 */
export async function migrateCategoryIdCleanup(userId: string): Promise<boolean> {
  const userDoc = doc(firebaseFirestore, 'users', userId);
  const migrationsRef = doc(collection(userDoc, 'preferences'), 'migrations');

  const markerSnap = await getDoc(migrationsRef);
  const markerData = markerSnap.data() as Record<string, unknown> | undefined;
  const markerExists = typeof markerSnap.exists === 'function'
    ? (markerSnap as any).exists()
    : markerSnap.exists;
  if (markerExists && markerData?.[MIGRATION_KEY]) {
    return false;
  }

  let updated = 0;

  // Strip categoryId from standards
  const standardsSnap = await getDocs(collection(userDoc, 'standards'));
  const promises: Promise<void>[] = [];
  standardsSnap.forEach((stdDoc: any) => {
    const data = stdDoc.data();
    if (!('categoryId' in data)) return;
    promises.push(
      stdDoc.ref.update({ categoryId: deleteField(), updatedAt: serverTimestamp() })
        .catch((err: any) => console.error(`[Migration:categoryId] standard ${stdDoc.id}:`, err?.message ?? err))
    );
    updated++;
  });

  // Strip categoryId from activities
  const activitiesSnap = await getDocs(collection(userDoc, 'activities'));
  activitiesSnap.forEach((actDoc: any) => {
    const data = actDoc.data();
    if (!('categoryId' in data)) return;
    promises.push(
      actDoc.ref.update({ categoryId: deleteField(), updatedAt: serverTimestamp() })
        .catch((err: any) => console.error(`[Migration:categoryId] activity ${actDoc.id}:`, err?.message ?? err))
    );
    updated++;
  });

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  await setDoc(migrationsRef, { [MIGRATION_KEY]: true, migratedAtMs: Date.now() }, { merge: true });
  console.info(`[Migration:categoryId] Done — cleaned ${updated} docs`);
  return true;
}
