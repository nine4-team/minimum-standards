import {
  FirebaseFirestoreTypes,
  collection,
  doc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import type { DashboardLayoutPage } from '@minimum-standards/shared-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import type { DashboardPlacement } from '../utils/dashboardPages';

export type DashboardLayoutServiceDoc = {
  pages: DashboardLayoutPage[];
  pageSize: 6;
  updatedAtMs: number;
};

export type DashboardLayoutSnapshot = DashboardLayoutServiceDoc | null;

type FirestoreDashboardLayoutData = {
  pages?: Array<{
    id?: unknown;
    name?: unknown;
    orderIndex?: unknown;
  }>;
  pageSize?: unknown;
  updatedAt?: FirebaseFirestoreTypes.Timestamp | null;
};

function dashboardLayoutRef(userId: string) {
  return doc(
    collection(doc(firebaseFirestore, 'users', userId), 'preferences'),
    'dashboardLayout'
  );
}

function standardRef(userId: string, standardId: string) {
  return doc(
    collection(doc(firebaseFirestore, 'users', userId), 'standards'),
    standardId
  );
}

function normalizePages(
  pages: FirestoreDashboardLayoutData['pages']
): DashboardLayoutPage[] {
  if (!Array.isArray(pages)) {
    return [];
  }

  return pages
    .map((page, index) => {
      if (typeof page.id !== 'string' || !page.id) return null;
      const name =
        typeof page.name === 'string' && page.name.trim()
          ? page.name.trim().slice(0, 40)
          : `Page ${index + 1}`;
      const orderIndex =
        typeof page.orderIndex === 'number' &&
        Number.isInteger(page.orderIndex) &&
        page.orderIndex >= 0
          ? page.orderIndex
          : index;
      return { id: page.id, name, orderIndex };
    })
    .filter((page): page is DashboardLayoutPage => Boolean(page))
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((page, index) => ({ ...page, orderIndex: index }));
}

function snapshotExists(snapshot: FirebaseFirestoreTypes.DocumentSnapshot): boolean {
  const exists = snapshot.exists as unknown;
  return typeof exists === 'function' ? Boolean(exists.call(snapshot)) : Boolean(exists);
}

export function subscribeToDashboardLayout(
  userId: string,
  onNext: (layout: DashboardLayoutSnapshot) => void,
  onError: (error: Error) => void
): () => void {
  return dashboardLayoutRef(userId).onSnapshot(
    (snapshot: FirebaseFirestoreTypes.DocumentSnapshot) => {
      if (!snapshotExists(snapshot)) {
        onNext(null);
        return;
      }

      const data = snapshot.data() as FirestoreDashboardLayoutData | undefined;
      if (!data) {
        onNext(null);
        return;
      }

      onNext({
        pages: normalizePages(data.pages),
        pageSize: 6,
        updatedAtMs: data.updatedAt?.toMillis() ?? Date.now(),
      });
    },
    (error: unknown) => onError(error instanceof Error ? error : new Error(String(error)))
  );
}

export async function saveDashboardLayout(
  userId: string,
  pages: DashboardLayoutPage[]
): Promise<void> {
  await dashboardLayoutRef(userId).set(
    {
      pages: pages
        .map((page, index) => ({
          id: page.id,
          name: page.name.trim().slice(0, 40) || `Page ${index + 1}`,
          orderIndex: index,
        })),
      pageSize: 6,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveDashboardPlacements(
  userId: string,
  placements: DashboardPlacement[]
): Promise<void> {
  const batch = firebaseFirestore.batch();
  placements.forEach((placement) => {
    batch.update(standardRef(userId, placement.standardId), {
      dashboardPageId: placement.dashboardPageId,
      dashboardOrderIndex: placement.dashboardOrderIndex,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function saveDashboardLayoutAndPlacements(
  userId: string,
  pages: DashboardLayoutPage[],
  placements: DashboardPlacement[]
): Promise<void> {
  const batch = firebaseFirestore.batch();
  batch.set(
    dashboardLayoutRef(userId),
    {
      pages: pages.map((page, index) => ({
        id: page.id,
        name: page.name.trim().slice(0, 40) || `Page ${index + 1}`,
        orderIndex: index,
      })),
      pageSize: 6,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  placements.forEach((placement) => {
    batch.update(standardRef(userId, placement.standardId), {
      dashboardPageId: placement.dashboardPageId,
      dashboardOrderIndex: placement.dashboardOrderIndex,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
