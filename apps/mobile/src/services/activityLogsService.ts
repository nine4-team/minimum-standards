import {
  FirebaseFirestoreTypes,
  Timestamp,
  collection,
  doc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';
import { FirestoreError } from '../utils/errors';
import { ActivityLogWritePayload } from '../utils/activityLogMutations';

export interface ActivityLogMutationTarget {
  userId: string;
  logEntryId: string;
}

type FirestoreWriteData = Record<string, unknown>;

export interface ActivityLogsServiceDependencies {
  getCurrentUserId: () => string | null;
  createDocumentId: (userId: string) => string;
  setDocument: (
    userId: string,
    logEntryId: string,
    data: FirestoreWriteData
  ) => Promise<void>;
  updateDocument: (
    userId: string,
    logEntryId: string,
    data: FirestoreWriteData
  ) => Promise<void>;
  getDocumentFromServer: (
    userId: string,
    logEntryId: string
  ) => Promise<{
    exists: boolean | (() => boolean);
    data: () => FirestoreWriteData | undefined;
  }>;
  fromMillis: (value: number) => unknown;
  serverTimestamp: () => unknown;
}

export interface ActivityLogsService {
  createDocumentId(userId: string): string;
  createOnce(input: ActivityLogWritePayload): Promise<void>;
  getFromServer(input: ActivityLogMutationTarget): Promise<ActivityLogWritePayload | null>;
  update(input: ActivityLogWritePayload): Promise<void>;
  softDelete(input: ActivityLogMutationTarget): Promise<void>;
  restore(input: ActivityLogMutationTarget): Promise<void>;
}

function assertAuthenticatedUser(
  expectedUserId: string,
  getCurrentUserId: () => string | null
): void {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    throw new FirestoreError(
      'firestore/unauthenticated',
      'Reconnecting your account. Your entry has not been submitted yet.',
      null
    );
  }
  if (currentUserId !== expectedUserId) {
    throw new FirestoreError(
      'firestore/unauthenticated',
      'The signed-in account changed. Your entry has not been submitted.',
      null
    );
  }
}

function normalizeServiceError(error: unknown): FirestoreError {
  return FirestoreError.fromFirebaseError(error);
}

function timestampToMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function createActivityLogsService(
  dependencies: ActivityLogsServiceDependencies
): ActivityLogsService {
  const run = async (userId: string, operation: () => Promise<void>): Promise<void> => {
    assertAuthenticatedUser(userId, dependencies.getCurrentUserId);
    try {
      await operation();
    } catch (error) {
      throw normalizeServiceError(error);
    }
  };

  return {
    createDocumentId(userId) {
      assertAuthenticatedUser(userId, dependencies.getCurrentUserId);
      return dependencies.createDocumentId(userId);
    },

    async createOnce(input) {
      await run(input.userId, () =>
        dependencies.setDocument(input.userId, input.id, {
          standardId: input.standardId,
          value: input.value,
          occurredAt: dependencies.fromMillis(input.occurredAtMs),
          note: input.note,
          createdAt: dependencies.serverTimestamp(),
          updatedAt: dependencies.serverTimestamp(),
          editedAt: null,
          deletedAt: null,
        })
      );
    },

    async getFromServer(input) {
      assertAuthenticatedUser(input.userId, dependencies.getCurrentUserId);
      try {
        const snapshot = await dependencies.getDocumentFromServer(
          input.userId,
          input.logEntryId
        );
        const exists =
          typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
        if (!exists) {
          return null;
        }
        const data = snapshot.data();
        const occurredAtMs = timestampToMillis(data?.occurredAt);
        if (
          !data ||
          typeof data.standardId !== 'string' ||
          typeof data.value !== 'number' ||
          occurredAtMs === null
        ) {
          throw new FirestoreError(
            'firestore/data-loss',
            'The saved activity log could not be verified.',
            null
          );
        }
        return {
          id: input.logEntryId,
          userId: input.userId,
          standardId: data.standardId,
          value: data.value,
          occurredAtMs,
          note: typeof data.note === 'string' ? data.note : null,
        };
      } catch (error) {
        throw normalizeServiceError(error);
      }
    },

    async update(input) {
      await run(input.userId, () =>
        dependencies.updateDocument(input.userId, input.id, {
          value: input.value,
          occurredAt: dependencies.fromMillis(input.occurredAtMs),
          note: input.note,
          editedAt: dependencies.serverTimestamp(),
          updatedAt: dependencies.serverTimestamp(),
        })
      );
    },

    async softDelete(input) {
      await run(input.userId, () =>
        dependencies.updateDocument(input.userId, input.logEntryId, {
          deletedAt: dependencies.serverTimestamp(),
          updatedAt: dependencies.serverTimestamp(),
        })
      );
    },

    async restore(input) {
      await run(input.userId, () =>
        dependencies.updateDocument(input.userId, input.logEntryId, {
          deletedAt: null,
          updatedAt: dependencies.serverTimestamp(),
        })
      );
    },
  };
}

function activityLogDocument(userId: string, logEntryId?: string) {
  const logs = collection(doc(firebaseFirestore, 'users', userId), 'activityLogs');
  return logEntryId ? doc(logs, logEntryId) : doc(logs);
}

const defaultDependencies: ActivityLogsServiceDependencies = {
  getCurrentUserId: () => firebaseAuth.currentUser?.uid ?? null,
  createDocumentId: (userId) => activityLogDocument(userId).id,
  setDocument: async (userId, logEntryId, data) => {
    await activityLogDocument(userId, logEntryId).set(data);
  },
  updateDocument: async (userId, logEntryId, data) => {
    await activityLogDocument(userId, logEntryId).update(data);
  },
  getDocumentFromServer: async (userId, logEntryId) => {
    const snapshot = await activityLogDocument(userId, logEntryId).get({ source: 'server' });
    return snapshot as FirebaseFirestoreTypes.DocumentSnapshot & {
      data: () => FirestoreWriteData | undefined;
    };
  },
  fromMillis: (value) => Timestamp.fromMillis(value),
  serverTimestamp,
};

export const activityLogsService = createActivityLogsService(defaultDependencies);
