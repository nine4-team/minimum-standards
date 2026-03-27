import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  query,
  serverTimestamp,
  Timestamp,
  where,
  deleteField,
} from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';
import {
  Standard,
  StandardCadence,
  StandardSessionConfig,
  ConfigEra,
  formatStandardSummary,
  PeriodStartPreference,
} from '@minimum-standards/shared-model';
import {
  FirestoreStandardData,
  fromFirestoreStandard,
  toFirestoreStandardDelete,
} from '../utils/standardConverter';
import { normalizeFirebaseError } from '../utils/errors';
import { retryFirestoreWrite } from '../utils/retry';
import { emitActivityLogMutation } from '../utils/activityLogEvents';
import { recomputeActivityHistoryPeriod } from '../utils/activityHistoryRecompute';

export interface CreateStandardInput {
  name: string;
  notes: string | null;
  categoryId: string | null;
  minimum: number;
  unit: string;
  cadence: StandardCadence;
  sessionConfig: StandardSessionConfig;
  periodStartPreference?: PeriodStartPreference;
}


export interface CreateLogInput {
  standardId: string;
  value: number;
  occurredAtMs: number;
  note?: string | null;
}

export interface UpdateLogInput {
  logEntryId: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
  note?: string | null;
}

export interface DeleteLogInput {
  logEntryId: string;
  standardId: string;
  occurredAtMs: number;
}

export interface RestoreLogInput {
  logEntryId: string;
  standardId: string;
  occurredAtMs: number;
}

export interface UpdateStandardInput {
  standardId: string;
  name: string;
  notes: string | null;
  categoryId: string | null;
  minimum: number;
  unit: string;
  cadence: StandardCadence;
  sessionConfig: StandardSessionConfig;
  periodStartPreference?: PeriodStartPreference;
  clearPeriodStartPreference?: boolean;
}

export interface UseStandardsResult {
  standards: Standard[];
  activeStandards: Standard[];
  archivedStandards: Standard[];
  orderedActiveStandards: Standard[];
  loading: boolean;
  error: Error | null;
  createStandard: (input: CreateStandardInput) => Promise<Standard>;
  updateStandard: (input: UpdateStandardInput) => Promise<Standard>;
  archiveStandard: (standardId: string) => Promise<void>;
  unarchiveStandard: (standardId: string) => Promise<void>;
  deleteStandard: (standardId: string) => Promise<void>;
  createLogEntry: (input: CreateLogInput) => Promise<void>;
  updateLogEntry: (input: UpdateLogInput) => Promise<void>;
  deleteLogEntry: (input: DeleteLogInput) => Promise<void>;
  restoreLogEntry: (input: RestoreLogInput) => Promise<void>;
  canLogStandard: (standardId: string) => boolean;
}

function sortByUpdatedAtDesc(list: Standard[]): Standard[] {
  return [...list].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export function useStandards(): UseStandardsResult {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [standardsLoading, setStandardsLoading] = useState(true);
  const [standardsError, setStandardsError] = useState<Error | null>(null);
  const userId = firebaseAuth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      console.warn('[useStandards] No user ID available - cannot subscribe to standards collection');
      setStandardsLoading(false);
      setStandardsError(new Error('User not authenticated'));
      return;
    }

    console.log('[useStandards] Subscribing to standards collection for user:', userId);
    setStandardsLoading(true);
    setStandardsError(null);

    const standardsQuery = query(
      collection(doc(firebaseFirestore, 'users', userId), 'standards'),
      where('deletedAt', '==', null)
    );

    const unsubscribe = standardsQuery.onSnapshot(
      (snapshot) => {
        try {
          const items: Standard[] = [];
          snapshot.forEach((docSnap) => {
            try {
              items.push(
                fromFirestoreStandard(
                  docSnap.id,
                  docSnap.data() as FirestoreStandardData
                )
              );
            } catch (parseError) {
              console.error(
                `Failed to parse standard ${docSnap.id}`,
                parseError
              );
            }
          });
          setStandards(sortByUpdatedAtDesc(items));
          setStandardsLoading(false);
        } catch (err) {
          setStandardsError(
            err instanceof Error ? err : new Error('Unknown error')
          );
          setStandardsLoading(false);
        }
      },
      (err) => {
        const normalizedError = normalizeFirebaseError(err);
        setStandardsError(normalizedError);
        setStandardsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);


  const activeStandards = useMemo(
    () => standards.filter((standard) => standard.state === 'active'),
    [standards]
  );

  const archivedStandards = useMemo(
    () => standards.filter((standard) => standard.state === 'archived'),
    [standards]
  );

  const orderedActiveStandards = useMemo(
    () => sortByUpdatedAtDesc(activeStandards),
    [activeStandards]
  );

  const createStandard = useCallback(
    async (input: CreateStandardInput): Promise<Standard> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standardsCollection = collection(
        doc(firebaseFirestore, 'users', userId),
        'standards'
      );

      const docRef = doc(standardsCollection);

      const payload = {
        name: input.name,
        notes: input.notes ?? null,
        categoryId: input.categoryId ?? null,
        minimum: input.minimum,
        unit: input.unit,
        cadence: input.cadence,
        state: 'active',
        summary: formatStandardSummary(
          input.minimum,
          input.unit,
          input.cadence,
          input.sessionConfig
        ),
        sessionConfig: input.sessionConfig,
        ...(input.periodStartPreference
          ? { periodStartPreference: input.periodStartPreference }
          : {}),
        archivedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        configEras: [],
      };

      await retryFirestoreWrite(async () => {
        await docRef.set(payload);
      });
      const snapshot = await retryFirestoreWrite(async () => {
        return await docRef.get();
      });
      const created = fromFirestoreStandard(
        snapshot.id,
        snapshot.data() as FirestoreStandardData
      );
      return created;
    },
    [userId]
  );

  const updateStandard = useCallback(
    async (input: UpdateStandardInput): Promise<Standard> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const previousStandard = standards.find((item) => item.id === input.standardId) ?? null;
      const standardRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'standards'),
        input.standardId
      );

      // Determine whether config is changing so we can build configEras before writing
      const inputPref = input.clearPeriodStartPreference
        ? null
        : (input.periodStartPreference ?? null);
      const prevPref = previousStandard?.periodStartPreference ?? null;
      const preferenceChanging =
        JSON.stringify(prevPref) !== JSON.stringify(inputPref);
      const configChanging = previousStandard
        ? previousStandard.minimum !== input.minimum ||
          previousStandard.unit !== input.unit ||
          previousStandard.cadence.interval !== input.cadence.interval ||
          previousStandard.cadence.unit !== input.cadence.unit ||
          previousStandard.sessionConfig.sessionsPerCadence !== input.sessionConfig.sessionsPerCadence ||
          previousStandard.sessionConfig.volumePerSession !== input.sessionConfig.volumePerSession ||
          preferenceChanging
        : false;

      const payload: Record<string, unknown> = {
        name: input.name,
        notes: input.notes ?? null,
        categoryId: input.categoryId ?? null,
        minimum: input.minimum,
        unit: input.unit,
        cadence: input.cadence,
        summary: formatStandardSummary(
          input.minimum,
          input.unit,
          input.cadence,
          input.sessionConfig
        ),
        sessionConfig: input.sessionConfig,
        updatedAt: serverTimestamp(),
      };

      if (input.periodStartPreference !== undefined) {
        payload.periodStartPreference = input.periodStartPreference;
      }

      if (input.clearPeriodStartPreference) {
        payload.periodStartPreference = deleteField();
      }

      // When config changes, append a new era so historical periods retain the old config
      if (configChanging && previousStandard) {
        const existingEras: ConfigEra[] = previousStandard.configEras ?? [];
        const nowMs = Date.now();

        let updatedEras: ConfigEra[];
        if (existingEras.length === 0) {
          // Seed initial era from previousStandard config, effective from creation
          const initialEra: ConfigEra = {
            effectiveFromMs: previousStandard.createdAtMs,
            minimum: previousStandard.minimum,
            unit: previousStandard.unit,
            cadence: previousStandard.cadence,
            sessionConfig: previousStandard.sessionConfig,
            summary: previousStandard.summary,
            ...(previousStandard.periodStartPreference
              ? { periodStartPreference: previousStandard.periodStartPreference }
              : {}),
          };
          updatedEras = [initialEra];
        } else {
          updatedEras = [...existingEras];
        }

        // Append new era for the incoming config
        const newEra: ConfigEra = {
          effectiveFromMs: nowMs,
          minimum: input.minimum,
          unit: input.unit,
          cadence: input.cadence,
          sessionConfig: input.sessionConfig,
          summary: formatStandardSummary(input.minimum, input.unit, input.cadence, input.sessionConfig),
          ...(inputPref ? { periodStartPreference: inputPref } : {}),
        };
        updatedEras = [...updatedEras, newEra];

        payload.configEras = updatedEras;
      }

      await retryFirestoreWrite(async () => {
        await standardRef.update(payload);
      });
      const snapshot = await retryFirestoreWrite(async () => {
        return await standardRef.get();
      });
      const updated = fromFirestoreStandard(
        snapshot.id,
        snapshot.data() as FirestoreStandardData
      );

      if (previousStandard) {
        const preferenceChanged =
          JSON.stringify(previousStandard.periodStartPreference ?? null) !==
          JSON.stringify(updated.periodStartPreference ?? null);
        const shouldRecompute =
          previousStandard.minimum !== updated.minimum ||
          previousStandard.unit !== updated.unit ||
          previousStandard.cadence.interval !== updated.cadence.interval ||
          previousStandard.cadence.unit !== updated.cadence.unit ||
          previousStandard.sessionConfig.sessionsPerCadence !==
            updated.sessionConfig.sessionsPerCadence ||
          previousStandard.sessionConfig.volumePerSession !==
            updated.sessionConfig.volumePerSession ||
          preferenceChanged;

        if (shouldRecompute) {
          triggerActivityHistoryRecompute(updated, Date.now(), previousStandard ?? undefined);
        }
      }
      return updated;
    },
    [userId, standards, triggerActivityHistoryRecompute]
  );

  const updateArchiveState = useCallback(
    async (standardId: string, shouldArchive: boolean): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standardRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'standards'),
        standardId
      );

      await retryFirestoreWrite(async () => {
        await standardRef.update({
          state: shouldArchive ? 'archived' : 'active',
          archivedAt: shouldArchive
            ? serverTimestamp()
            : null,
          updatedAt: serverTimestamp(),
        });
      });
    },
    [userId]
  );

  const archiveStandard = useCallback(
    async (standardId: string) => updateArchiveState(standardId, true),
    [updateArchiveState]
  );

  const unarchiveStandard = useCallback(
    async (standardId: string) => updateArchiveState(standardId, false),
    [updateArchiveState]
  );

  const deleteStandard = useCallback(
    async (standardId: string): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standardRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'standards'),
        standardId
      );

      // Optimistic update: remove from list
      const standardToDelete = standards.find((s) => s.id === standardId);
      setStandards((prev) => prev.filter((s) => s.id !== standardId));

      try {
        // Soft delete by setting deletedAt
        const firestoreData = toFirestoreStandardDelete();
        await retryFirestoreWrite(async () => {
          await standardRef.update(firestoreData);
        });
      } catch (err) {
        // Rollback: restore standard
        if (standardToDelete) {
          setStandards((prev) => {
            const updated = [...prev, standardToDelete];
            return sortByUpdatedAtDesc(updated);
          });
        }
        throw err;
      }
    },
    [userId, standards]
  );

  const canLogStandard = useCallback(
    (standardId: string): boolean => {
      const standard = standards.find((item) => item.id === standardId);
      if (!standard) {
        return false;
      }
      return standard.state === 'active' && standard.archivedAtMs == null;
    },
    [standards]
  );

  const triggerActivityHistoryRecompute = useCallback(
    (standard: Standard, occurredAtMs: number, previousStandard?: Standard) => {
      if (!userId) {
        return;
      }

      void recomputeActivityHistoryPeriod({
        userId,
        standard,
        occurredAtMs,
        previousStandard,
      }).catch((error) => {
        console.error(
          '[useStandards] Failed to recompute activity history period',
          error
        );
      });
    },
    [userId]
  );

  const createLogEntry = useCallback(
    async ({ standardId, value, occurredAtMs, note = null }: CreateLogInput) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const target = standards.find((standard) => standard.id === standardId);
      if (!target) {
        throw new Error('Standard not found');
      }
      if (!canLogStandard(standardId)) {
        throw new Error(
          'This Standard is inactive. Activate it to resume logging.'
        );
      }

      const logsRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs')
      );

      await retryFirestoreWrite(async () => {
        await logsRef.set({
          standardId,
          value,
          occurredAt: Timestamp.fromMillis(occurredAtMs),
          note,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          editedAt: null,
          deletedAt: null,
        });
      });

      emitActivityLogMutation({
        type: 'create',
        standardId,
        activityId: target.activityId,
        occurredAtMs,
        logEntryId: logsRef.id,
      });

      triggerActivityHistoryRecompute(target, occurredAtMs);
    },
    [userId, standards, canLogStandard, triggerActivityHistoryRecompute]
  );

  const updateLogEntry = useCallback(
    async ({ logEntryId, standardId, value, occurredAtMs, note = null }: UpdateLogInput) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standard = standards.find((item) => item.id === standardId);
      if (!standard) {
        throw new Error('Standard not found');
      }

      if (!canLogStandard(standardId)) {
        throw new Error(
          'This Standard is inactive. Activate it to edit logs.'
        );
      }

      const logRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        logEntryId
      );

      await retryFirestoreWrite(async () => {
        await logRef.update({
          value,
          occurredAt: Timestamp.fromMillis(occurredAtMs),
          note,
          editedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      emitActivityLogMutation({
        type: 'update',
        standardId,
        activityId: standard.activityId,
        occurredAtMs,
        logEntryId,
      });

      triggerActivityHistoryRecompute(standard, occurredAtMs);
    },
    [userId, standards, canLogStandard, triggerActivityHistoryRecompute]
  );

  const deleteLogEntry = useCallback(
    async ({ logEntryId, standardId, occurredAtMs }: DeleteLogInput) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standard = standards.find((item) => item.id === standardId);
      if (!standard) {
        throw new Error('Standard not found');
      }

      if (!canLogStandard(standardId)) {
        throw new Error(
          'This Standard is inactive. Activate it to delete logs.'
        );
      }

      const logRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        logEntryId
      );

      await retryFirestoreWrite(async () => {
        await logRef.update({
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      emitActivityLogMutation({
        type: 'delete',
        standardId,
        activityId: standard.activityId,
        occurredAtMs,
        logEntryId,
      });

      triggerActivityHistoryRecompute(standard, occurredAtMs);
    },
    [userId, standards, canLogStandard, triggerActivityHistoryRecompute]
  );

  const restoreLogEntry = useCallback(
    async ({ logEntryId, standardId, occurredAtMs }: RestoreLogInput) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const standard = standards.find((item) => item.id === standardId);
      if (!standard) {
        throw new Error('Standard not found');
      }

      if (!canLogStandard(standardId)) {
        throw new Error(
          'This Standard is inactive. Activate it to restore logs.'
        );
      }

      const logRef = doc(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        logEntryId
      );

      await retryFirestoreWrite(async () => {
        await logRef.update({
          deletedAt: null,
          updatedAt: serverTimestamp(),
        });
      });

      emitActivityLogMutation({
        type: 'restore',
        standardId,
        activityId: standard.activityId,
        occurredAtMs,
        logEntryId,
      });

      triggerActivityHistoryRecompute(standard, occurredAtMs);
    },
    [userId, standards, canLogStandard, triggerActivityHistoryRecompute]
  );

  const loading = standardsLoading;
  const error = standardsError;

  return {
    standards,
    activeStandards,
    archivedStandards,
    orderedActiveStandards,
    loading,
    error,
    createStandard,
    updateStandard,
    archiveStandard,
    unarchiveStandard,
    deleteStandard,
    createLogEntry,
    updateLogEntry,
    deleteLogEntry,
    restoreLogEntry,
    canLogStandard,
  };
}
