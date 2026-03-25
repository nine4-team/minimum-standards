import {
  collection,
  doc,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import {
  Activity,
  Category,
  Standard,
  formatStandardSummary,
  normalizeUnitToPlural,
} from '@minimum-standards/shared-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { findMatchingStandard } from './standardsFilter';
import { toFirestoreActivity } from './activityConverter';
import { toFirestoreCategory } from './categoryConverter';
import type { SnapshotPayload } from '../types/snapshots';

type SnapshotImportErrorCode =
  | 'share-link-not-found'
  | 'share-link-disabled'
  | 'snapshot-not-found'
  | 'snapshot-disabled'
  | 'snapshot-deleted'
  | 'payload-missing'
  | 'payload-invalid'
  | 'payload-empty';

export class SnapshotImportError extends Error {
  code: SnapshotImportErrorCode;

  constructor(code: SnapshotImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function activityKey(name: string, unit: string, categoryId: string | null): string {
  const normalizedUnit = normalizeUnitToPlural(unit).toLowerCase();
  return `${normalizeName(name)}|${normalizedUnit}|${categoryId ?? 'uncategorized'}`;
}

function isSnapshotPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as SnapshotPayload;
  if (!Array.isArray(payload.categories) || !Array.isArray(payload.activities) || !Array.isArray(payload.standards)) {
    return false;
  }

  const categoryValid = payload.categories.every((category) => {
    return (
      category
      && typeof category.id === 'string'
      && typeof category.name === 'string'
      && typeof category.order === 'number'
      && (category.isSystem == null || typeof category.isSystem === 'boolean')
    );
  });
  if (!categoryValid) {
    return false;
  }

  const activityValid = payload.activities.every((activity) => {
    return (
      activity
      && typeof activity.id === 'string'
      && typeof activity.name === 'string'
      && typeof activity.unit === 'string'
      && (activity.notes == null || typeof activity.notes === 'string')
      && (activity.categoryId == null || typeof activity.categoryId === 'string')
    );
  });
  if (!activityValid) {
    return false;
  }

  const standardsValid = payload.standards.every((standard) => {
    return (
      standard
      && typeof standard.id === 'string'
      && typeof standard.activityId === 'string'
      && typeof standard.minimum === 'number'
      && typeof standard.unit === 'string'
      && typeof standard.cadence === 'object'
      && standard.cadence != null
      && typeof standard.cadence.interval === 'number'
      && typeof standard.cadence.unit === 'string'
      && typeof standard.sessionConfig === 'object'
      && standard.sessionConfig != null
      && typeof standard.sessionConfig.sessionLabel === 'string'
      && typeof standard.sessionConfig.sessionsPerCadence === 'number'
      && typeof standard.sessionConfig.volumePerSession === 'number'
    );
  });
  if (!standardsValid) {
    return false;
  }

  return true;
}

export function buildSnapshotPayload({
  standards,
  activities,
  categories,
  selectedStandardIds,
}: {
  standards: Standard[];
  activities: Activity[];
  categories: Category[];
  selectedStandardIds: string[];
}): SnapshotPayload {
  const selectedSet = new Set(selectedStandardIds);
  const selectedStandards = standards.filter((standard) => selectedSet.has(standard.id));
  const activityIds = new Set(selectedStandards.map((standard) => standard.activityId));
  const selectedActivities = activities.filter((activity) => activityIds.has(activity.id));
  const categoryIds = new Set(
    selectedActivities
      .map((activity) => activity.categoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId))
  );
  const selectedCategories = categories.filter((category) => categoryIds.has(category.id));

  return {
    categories: selectedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      order: category.order,
      isSystem: category.isSystem ?? false,
    })),
    activities: selectedActivities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      unit: activity.unit,
      notes: activity.notes ?? null,
      categoryId: activity.categoryId ?? null,
    })),
    standards: selectedStandards.map((standard) => ({
      id: standard.id,
      activityId: standard.activityId,
      minimum: standard.minimum,
      unit: standard.unit,
      cadence: standard.cadence,
      sessionConfig: standard.sessionConfig,
      ...(standard.periodStartPreference
        ? { periodStartPreference: standard.periodStartPreference }
        : {}),
    })),
  };
}

export async function importSnapshotForUser({
  userId,
  shareCode,
}: {
  userId: string;
  shareCode: string;
}): Promise<{
  snapshotId: string;
  ownerUserId: string;
  isOwnSnapshot: boolean;
  alreadyInstalled: boolean;
  createdCounts: {
    categories: number;
    activities: number;
    standards: number;
  };
}> {
  const shareLinkQuery = query(
    collection(firebaseFirestore, 'shareLinks'),
    where('shareCode', '==', shareCode)
  );
  const shareLinkSnapshot = await shareLinkQuery.get();
  if (shareLinkSnapshot.empty) {
    throw new SnapshotImportError('share-link-not-found', 'Share link not found');
  }

  const shareLinkDoc = shareLinkSnapshot.docs[0];
  const shareLinkData = shareLinkDoc.data() as {
    snapshotId: string;
    ownerUserId: string;
    disabledAt?: unknown;
  };
  if (!shareLinkData.snapshotId || !shareLinkData.ownerUserId) {
    throw new SnapshotImportError('share-link-not-found', 'Share link is missing data');
  }
  if (shareLinkData.disabledAt != null) {
    throw new SnapshotImportError('share-link-disabled', 'Share link is disabled');
  }

  const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'), shareLinkData.snapshotId);
  const snapshotDoc = await snapshotRef.get();
  if (!snapshotDoc.exists) {
    throw new SnapshotImportError('snapshot-not-found', 'Snapshot not found');
  }
  const snapshotData = snapshotDoc.data() as {
    ownerUserId: string;
    isEnabled?: boolean;
    payload?: SnapshotPayload;
    deletedAt?: unknown;
  };
  if (snapshotData.deletedAt != null) {
    throw new SnapshotImportError('snapshot-deleted', 'Snapshot was deleted');
  }
  if (snapshotData.isEnabled === false) {
    throw new SnapshotImportError('snapshot-disabled', 'Snapshot is disabled');
  }
  if (!snapshotData.payload) {
    throw new SnapshotImportError('payload-missing', 'Snapshot payload is missing');
  }
  if (!isSnapshotPayload(snapshotData.payload)) {
    throw new SnapshotImportError('payload-invalid', 'Snapshot payload is invalid');
  }
  if (snapshotData.payload.standards.length === 0) {
    throw new SnapshotImportError('payload-empty', 'Snapshot has no standards to import');
  }

  if (snapshotData.ownerUserId === userId) {
    return {
      snapshotId: snapshotDoc.id,
      ownerUserId: snapshotData.ownerUserId,
      isOwnSnapshot: true,
      alreadyInstalled: false,
      createdCounts: { categories: 0, activities: 0, standards: 0 },
    };
  }

  const installRef = doc(
    collection(doc(firebaseFirestore, 'users', userId), 'snapshotInstalls'),
    snapshotDoc.id
  );
  const installDoc = await installRef.get();
  if (installDoc.exists) {
    return {
      snapshotId: snapshotDoc.id,
      ownerUserId: snapshotData.ownerUserId,
      isOwnSnapshot: false,
      alreadyInstalled: true,
      createdCounts: { categories: 0, activities: 0, standards: 0 },
    };
  }

  const categoriesQuery = query(
    collection(doc(firebaseFirestore, 'users', userId), 'categories'),
    where('deletedAt', '==', null)
  );
  const activitiesQuery = query(
    collection(doc(firebaseFirestore, 'users', userId), 'activities'),
    where('deletedAt', '==', null)
  );
  const standardsQuery = query(
    collection(doc(firebaseFirestore, 'users', userId), 'standards'),
    where('deletedAt', '==', null)
  );

  const [categoriesSnapshot, activitiesSnapshot, standardsSnapshot] = await Promise.all([
    categoriesQuery.get(),
    activitiesQuery.get(),
    standardsQuery.get(),
  ]);

  const existingCategories = categoriesSnapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as any),
  }));
  const existingActivities = activitiesSnapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as any),
  }));
  const existingStandardDocs = new Map<string, { ref: any; data: Record<string, any> }>();
  const existingStandards = standardsSnapshot.docs.map((item) => {
    const data = item.data() as Record<string, any>;
    existingStandardDocs.set(item.id, { ref: item.ref, data });
    return {
      id: item.id,
      activityId: data.activityId,
      cadence: data.cadence,
      minimum: data.minimum,
      unit: data.unit,
      state: data.state,
    };
  }) as Standard[];

  const categoryNameMap = new Map<string, string>();
  existingCategories.forEach((category) => {
    if (typeof category.name === 'string') {
      categoryNameMap.set(normalizeName(category.name), category.id);
    }
  });

  const categoryIdMap = new Map<string, string>();
  let createdCategoryCount = 0;
  const batch = firebaseFirestore.batch();

  snapshotData.payload.categories.forEach((category) => {
    const normalized = normalizeName(category.name);
    const existingId = categoryNameMap.get(normalized);
    if (existingId) {
      categoryIdMap.set(category.id, existingId);
      return;
    }

    const categoryRef = doc(
      collection(doc(firebaseFirestore, 'users', userId), 'categories')
    );
    batch.set(categoryRef, toFirestoreCategory({
      name: category.name,
      order: category.order,
      isSystem: category.isSystem ?? false,
    }));
    categoryIdMap.set(category.id, categoryRef.id);
    categoryNameMap.set(normalized, categoryRef.id);
    createdCategoryCount += 1;
  });

  const existingActivityKeyMap = new Map<string, string>();
  existingActivities.forEach((activity) => {
    if (typeof activity.name !== 'string' || typeof activity.unit !== 'string') {
      return;
    }
    const key = activityKey(activity.name, activity.unit, activity.categoryId ?? null);
    existingActivityKeyMap.set(key, activity.id);
  });

  const activityIdMap = new Map<string, string>();
  let createdActivityCount = 0;

  snapshotData.payload.activities.forEach((activity) => {
    const mappedCategoryId = activity.categoryId
      ? categoryIdMap.get(activity.categoryId) ?? null
      : null;
    const key = activityKey(activity.name, activity.unit, mappedCategoryId);
    const existingId = existingActivityKeyMap.get(key);
    if (existingId) {
      activityIdMap.set(activity.id, existingId);
      return;
    }

    const activityRef = doc(
      collection(doc(firebaseFirestore, 'users', userId), 'activities')
    );
    batch.set(activityRef, toFirestoreActivity({
      name: activity.name,
      unit: activity.unit,
      notes: activity.notes ?? null,
      categoryId: mappedCategoryId,
    }));
    activityIdMap.set(activity.id, activityRef.id);
    existingActivityKeyMap.set(key, activityRef.id);
    createdActivityCount += 1;
  });

  let createdStandardCount = 0;
  const updatedStandardIds = new Set<string>();

  snapshotData.payload.standards.forEach((standard) => {
    const mappedActivityId = activityIdMap.get(standard.activityId);
    if (!mappedActivityId) {
      return;
    }
    const existing = findMatchingStandard(
      existingStandards,
      mappedActivityId,
      standard.cadence,
      standard.minimum,
      standard.unit
    );
    if (existing) {
      const match = existingStandardDocs.get(existing.id);
      const isArchived = match?.data?.archivedAt != null || match?.data?.state === 'archived';
      if (isArchived && match && !updatedStandardIds.has(existing.id)) {
        batch.update(match.ref, {
          state: 'active',
          archivedAt: null,
          updatedAt: serverTimestamp(),
        });
        updatedStandardIds.add(existing.id);
      }
      return;
    }

    const standardRef = doc(
      collection(doc(firebaseFirestore, 'users', userId), 'standards')
    );
    batch.set(standardRef, {
      activityId: mappedActivityId,
      minimum: standard.minimum,
      unit: standard.unit,
      cadence: standard.cadence,
      state: 'active',
      summary: formatStandardSummary(
        standard.minimum,
        standard.unit,
        standard.cadence,
        standard.sessionConfig
      ),
      sessionConfig: standard.sessionConfig,
      ...(standard.periodStartPreference
        ? { periodStartPreference: standard.periodStartPreference }
        : {}),
      archivedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    });
    createdStandardCount += 1;
  });

  batch.set(installRef, {
    snapshotId: snapshotDoc.id,
    ownerUserId: snapshotData.ownerUserId,
    installedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    snapshotId: snapshotDoc.id,
    ownerUserId: snapshotData.ownerUserId,
    isOwnSnapshot: false,
    alreadyInstalled: false,
    createdCounts: {
      categories: createdCategoryCount,
      activities: createdActivityCount,
      standards: createdStandardCount,
    },
  };
}
