import {
  collection,
  doc,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import {
  Standard,
  formatStandardSummary,
  normalizeUnitToPlural,
} from '@minimum-standards/shared-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import type { SnapshotPayload, SnapshotPayloadV2 } from '../types/snapshots';

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


function isValidStandardBase(standard: any): boolean {
  return (
    standard
    && typeof standard.id === 'string'
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
}

/** Detects whether this is a v2 payload (standards have name inline, no activities array required). */
function isSnapshotPayloadV2(value: unknown): value is SnapshotPayloadV2 {
  if (!value || typeof value !== 'object') return false;
  const payload = value as any;
  if (payload.version !== 2) return false;
  if (!Array.isArray(payload.standards)) return false;
  return payload.standards.every((standard: any) => {
    return isValidStandardBase(standard) && typeof standard.name === 'string';
  });
}

/** Detects whether this is a v1 payload (standards reference activityId, activities array present). */
function isSnapshotPayloadV1(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as any;
  if (!Array.isArray(payload.activities) || !Array.isArray(payload.standards)) return false;

  const activityValid = payload.activities.every((activity: any) => {
    return (
      activity
      && typeof activity.id === 'string'
      && typeof activity.name === 'string'
      && typeof activity.unit === 'string'
      && (activity.notes == null || typeof activity.notes === 'string')
    );
  });
  if (!activityValid) return false;

  return payload.standards.every((standard: any) => {
    return isValidStandardBase(standard) && typeof standard.activityId === 'string';
  });
}

/** Convert a v1 payload to v2 by inlining activity fields into standards. */
function convertV1toV2(payload: SnapshotPayload): SnapshotPayloadV2 {
  const activityMap = new Map(payload.activities.map((a) => [a.id, a]));
  return {
    version: 2,
    standards: payload.standards.map((standard) => {
      const activity = activityMap.get(standard.activityId);
      return {
        id: standard.id,
        name: activity?.name ?? 'Unknown',
        notes: activity?.notes ?? null,
        minimum: standard.minimum,
        unit: standard.unit,
        cadence: standard.cadence,
        sessionConfig: standard.sessionConfig,
        ...(standard.periodStartPreference
          ? { periodStartPreference: standard.periodStartPreference }
          : {}),
      };
    }),
  };
}

function isSnapshotPayload(value: unknown): value is SnapshotPayloadV2 {
  if (isSnapshotPayloadV2(value)) return true;
  if (isSnapshotPayloadV1(value)) return true;
  return false;
}

/** Normalize any version to V2. */
function normalizePayload(value: unknown): SnapshotPayloadV2 | null {
  if (isSnapshotPayloadV2(value)) return value;
  if (isSnapshotPayloadV1(value)) return convertV1toV2(value);
  return null;
}

export function buildSnapshotPayload({
  standards,
  selectedStandardIds,
}: {
  standards: Standard[];
  selectedStandardIds: string[];
}): SnapshotPayloadV2 {
  const selectedSet = new Set(selectedStandardIds);
  const selectedStandards = standards.filter((standard) => selectedSet.has(standard.id));

  return {
    version: 2,
    standards: selectedStandards.map((standard) => ({
      id: standard.id,
      name: standard.name,
      notes: standard.notes ?? null,
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
  const normalizedPayload = normalizePayload(snapshotData.payload);
  if (!normalizedPayload) {
    throw new SnapshotImportError('payload-invalid', 'Snapshot payload could not be normalized');
  }
  if (normalizedPayload.standards.length === 0) {
    throw new SnapshotImportError('payload-empty', 'Snapshot has no standards to import');
  }

  if (snapshotData.ownerUserId === userId) {
    return {
      snapshotId: snapshotDoc.id,
      ownerUserId: snapshotData.ownerUserId,
      isOwnSnapshot: true,
      alreadyInstalled: false,
      createdCounts: { standards: 0 },
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
      createdCounts: { standards: 0 },
    };
  }

  const standardsQuery = query(
    collection(doc(firebaseFirestore, 'users', userId), 'standards'),
    where('deletedAt', '==', null)
  );

  const standardsSnapshot = await standardsQuery.get();

  const existingStandardDocs = new Map<string, { ref: any; data: Record<string, any> }>();
  const existingStandards = standardsSnapshot.docs.map((item) => {
    const data = item.data() as Record<string, any>;
    existingStandardDocs.set(item.id, { ref: item.ref, data });
    return {
      id: item.id,
      name: data.name,
      cadence: data.cadence,
      minimum: data.minimum,
      unit: data.unit,
      state: data.state,
    };
  }) as Standard[];

  const batch = firebaseFirestore.batch();

  let createdStandardCount = 0;
  const updatedStandardIds = new Set<string>();

  // Build a key for matching existing standards by name + cadence + minimum + unit
  function standardKey(name: string, cadence: any, minimum: number, unit: string): string {
    const normalizedUnit = normalizeUnitToPlural(unit).toLowerCase();
    return `${normalizeName(name)}|${cadence.interval}|${cadence.unit}|${minimum}|${normalizedUnit}`;
  }

  const existingStandardKeyMap = new Map<string, Standard>();
  for (const std of existingStandards) {
    const key = standardKey(std.name, std.cadence, std.minimum, std.unit);
    existingStandardKeyMap.set(key, std);
  }

  normalizedPayload.standards.forEach((standard) => {
    // Try to find an existing standard with matching name/cadence/minimum/unit
    const key = standardKey(standard.name, standard.cadence, standard.minimum, standard.unit);
    const existing = existingStandardKeyMap.get(key);

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
      name: standard.name,
      notes: standard.notes ?? null,
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
      standards: createdStandardCount,
    },
  };
}
