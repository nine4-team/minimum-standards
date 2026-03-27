import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';
import { generateShareCode } from '../utils/snapshotLinks';
import type { ShareLinkRecord, AnySnapshotPayload, SnapshotRecord } from '../types/snapshots';

type FirestoreTimestamp = { toMillis: () => number } | null;

type FirestoreSnapshotData = {
  ownerUserId: string;
  title: string;
  description?: string | null;
  version: number;
  isEnabled?: boolean;
  payload: AnySnapshotPayload;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  deletedAt?: FirestoreTimestamp;
};

type FirestoreShareLinkData = {
  shareCode: string;
  snapshotId: string;
  ownerUserId: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  disabledAt?: FirestoreTimestamp;
};

function toMillis(timestamp: FirestoreTimestamp): number {
  return timestamp?.toMillis() ?? Date.now();
}

export type UseSnapshotsResult = {
  snapshots: SnapshotRecord[];
  loading: boolean;
  error: Error | null;
  createSnapshot: (input: { title: string; payload: AnySnapshotPayload }) => Promise<SnapshotRecord>;
  toggleSnapshotEnabled: (snapshotId: string, isEnabled: boolean) => Promise<void>;
  updateSnapshotTitle: (snapshotId: string, title: string) => Promise<void>;
  updateSnapshotPayload: (input: {
    snapshotId: string;
    payload: AnySnapshotPayload;
    nextVersion: number;
  }) => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  getOrCreateShareLink: (snapshotId: string) => Promise<ShareLinkRecord>;
  regenerateShareLink: (shareLinkId: string) => Promise<ShareLinkRecord>;
  fetchShareLinkForSnapshot: (snapshotId: string) => Promise<ShareLinkRecord | null>;
};

export function useSnapshots(): UseSnapshotsResult {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const userId = firebaseAuth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(new Error('User not authenticated'));
      return;
    }

    setLoading(true);
    setError(null);
    const snapshotsQuery = query(
      collection(firebaseFirestore, 'snapshots'),
      where('ownerUserId', '==', userId),
      where('deletedAt', '==', null)
    );

    const unsubscribe = snapshotsQuery.onSnapshot(
      (snapshot) => {
        const items: SnapshotRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FirestoreSnapshotData;
          items.push({
            id: docSnap.id,
            ownerUserId: data.ownerUserId,
            title: data.title,
            description: data.description ?? null,
            version: data.version,
            isEnabled: data.isEnabled ?? true,
            payload: data.payload,
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
            deletedAtMs: data.deletedAt?.toMillis?.() ?? null,
          });
        });
        setSnapshots(items.sort((a, b) => b.updatedAtMs - a.updatedAtMs));
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error('Failed to load snapshots'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const createSnapshot = useCallback(
    async ({ title, payload }: { title: string; payload: AnySnapshotPayload }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'));
      const record = {
        ownerUserId: userId,
        title: title.trim(),
        description: null,
        version: 1,
        isEnabled: true,
        payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      };
      await snapshotRef.set(record);
      const created = await snapshotRef.get();
      const data = created.data() as FirestoreSnapshotData;
      return {
        id: created.id,
        ownerUserId: data.ownerUserId,
        title: data.title,
        description: data.description ?? null,
        version: data.version,
        isEnabled: data.isEnabled ?? true,
        payload: data.payload,
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        deletedAtMs: data.deletedAt?.toMillis?.() ?? null,
      };
    },
    [userId]
  );

  const toggleSnapshotEnabled = useCallback(
    async (snapshotId: string, isEnabled: boolean) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'), snapshotId);
      await snapshotRef.update({
        isEnabled,
        updatedAt: serverTimestamp(),
      });
    },
    [userId]
  );

  const updateSnapshotTitle = useCallback(
    async (snapshotId: string, title: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'), snapshotId);
      await snapshotRef.update({
        title: title.trim(),
        updatedAt: serverTimestamp(),
      });
    },
    [userId]
  );

  const updateSnapshotPayload = useCallback(
    async ({
      snapshotId,
      payload,
      nextVersion,
    }: {
      snapshotId: string;
      payload: AnySnapshotPayload;
      nextVersion: number;
    }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'), snapshotId);
      await snapshotRef.update({
        payload,
        version: nextVersion,
        updatedAt: serverTimestamp(),
      });
    },
    [userId]
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const snapshotRef = doc(collection(firebaseFirestore, 'snapshots'), snapshotId);
      await snapshotRef.update({
        isEnabled: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const shareLinkQuery = query(
        collection(firebaseFirestore, 'shareLinks'),
        where('snapshotId', '==', snapshotId)
      );
      const shareLinkSnapshot = await shareLinkQuery.get();
      if (shareLinkSnapshot.empty) {
        return;
      }
      const batch = firebaseFirestore.batch();
      shareLinkSnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          disabledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    },
    [userId]
  );

  const fetchShareLinkForSnapshot = useCallback(
    async (snapshotId: string): Promise<ShareLinkRecord | null> => {
      const shareLinkQuery = query(
        collection(firebaseFirestore, 'shareLinks'),
        where('snapshotId', '==', snapshotId)
      );
      const shareLinkSnapshot = await shareLinkQuery.get();
      if (shareLinkSnapshot.empty) {
        return null;
      }
      const shareLinkDoc = shareLinkSnapshot.docs[0];
      const data = shareLinkDoc.data() as FirestoreShareLinkData;
      return {
        id: shareLinkDoc.id,
        shareCode: data.shareCode,
        snapshotId: data.snapshotId,
        ownerUserId: data.ownerUserId,
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        disabledAtMs: data.disabledAt?.toMillis?.() ?? null,
      };
    },
    []
  );

  const getOrCreateShareLink = useCallback(
    async (snapshotId: string): Promise<ShareLinkRecord> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const existing = await fetchShareLinkForSnapshot(snapshotId);
      if (existing && existing.disabledAtMs == null) {
        return existing;
      }
      const shareLinkRef = doc(collection(firebaseFirestore, 'shareLinks'));
      const record = {
        shareCode: generateShareCode(),
        snapshotId,
        ownerUserId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        disabledAt: null,
      };
      await shareLinkRef.set(record);
      const created = await shareLinkRef.get();
      const data = created.data() as FirestoreShareLinkData;
      return {
        id: created.id,
        shareCode: data.shareCode,
        snapshotId: data.snapshotId,
        ownerUserId: data.ownerUserId,
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        disabledAtMs: data.disabledAt?.toMillis?.() ?? null,
      };
    },
    [userId, fetchShareLinkForSnapshot]
  );

  const regenerateShareLink = useCallback(
    async (shareLinkId: string): Promise<ShareLinkRecord> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const shareLinkRef = doc(collection(firebaseFirestore, 'shareLinks'), shareLinkId);
      await shareLinkRef.update({
        shareCode: generateShareCode(),
        updatedAt: serverTimestamp(),
        disabledAt: null,
      });
      const updated = await shareLinkRef.get();
      const data = updated.data() as FirestoreShareLinkData;
      return {
        id: updated.id,
        shareCode: data.shareCode,
        snapshotId: data.snapshotId,
        ownerUserId: data.ownerUserId,
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        disabledAtMs: data.disabledAt?.toMillis?.() ?? null,
      };
    },
    [userId]
  );

  return {
    snapshots,
    loading,
    error,
    createSnapshot,
    toggleSnapshotEnabled,
    updateSnapshotTitle,
    updateSnapshotPayload,
    deleteSnapshot,
    getOrCreateShareLink,
    regenerateShareLink,
    fetchShareLinkForSnapshot,
  };
}
