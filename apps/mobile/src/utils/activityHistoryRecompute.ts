import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from '@react-native-firebase/firestore';
import {
  Standard,
  calculatePeriodWindow,
  derivePeriodStatus,
} from '@minimum-standards/shared-model';
import { buildActivityHistoryDocId } from '@minimum-standards/firestore-model';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { writeActivityHistoryPeriod } from './activityHistoryFirestore';

export interface RecomputeActivityHistoryPeriodParams {
  userId: string;
  standard: Standard;
  occurredAtMs: number;
  source?: 'log-edit';
  previousStandard?: Standard;
}

export async function recomputeActivityHistoryPeriod({
  userId,
  standard,
  occurredAtMs,
  source = 'log-edit',
  previousStandard,
}: RecomputeActivityHistoryPeriodParams): Promise<void> {
  if (!userId) {
    throw new Error('[activityHistoryRecompute] userId is required');
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const window = calculatePeriodWindow(
    occurredAtMs,
    standard.cadence,
    timezone,
    { periodStartPreference: standard.periodStartPreference }
  );

  const logsQuery = query(
    collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
    where('standardId', '==', standard.id),
    where('occurredAt', '>=', Timestamp.fromMillis(window.startMs)),
    where('occurredAt', '<', Timestamp.fromMillis(window.endMs))
  );

  const snapshot = await getDocs(logsQuery);
  const logs: Array<{ value: number }> = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.deletedAt) {
      return;
    }
    if (typeof data.value === 'number') {
      logs.push({ value: data.value });
    }
  });

  const total = logs.reduce((sum, log) => sum + log.value, 0);
  const currentSessions = logs.length;
  const targetSessions = standard.sessionConfig.sessionsPerCadence;
  const nowMs = Date.now();
  const status = derivePeriodStatus(total, standard.minimum, nowMs, window.endMs);
  const safeMinimum = Math.max(standard.minimum, 0);
  const ratio = safeMinimum === 0 ? 1 : Math.min(total / safeMinimum, 1);
  const progressPercent = Number.isFinite(ratio)
    ? Number((ratio * 100).toFixed(2))
    : 0;

  const standardSnapshot = {
    minimum: standard.minimum,
    unit: standard.unit,
    cadence: standard.cadence,
    sessionConfig: standard.sessionConfig,
    summary: standard.summary,
    ...(standard.periodStartPreference
      ? { periodStartPreference: standard.periodStartPreference }
      : {}),
  };

  await writeActivityHistoryPeriod({
    userId,
    activityId: standard.activityId,
    standardId: standard.id,
    window,
    standardSnapshot,
    rollup: {
      total,
      currentSessions,
      targetSessions,
      status,
      progressPercent,
    },
    source,
  });

  // Clean up orphaned doc if boundary shifted
  if (previousStandard) {
    const oldWindow = calculatePeriodWindow(
      occurredAtMs,
      previousStandard.cadence,
      timezone,
      { periodStartPreference: previousStandard.periodStartPreference }
    );
    const oldDocId = buildActivityHistoryDocId(standard.activityId, standard.id, oldWindow.startMs);
    const newDocId = buildActivityHistoryDocId(standard.activityId, standard.id, window.startMs);

    if (oldDocId !== newDocId) {
      const userDocRef = doc(firebaseFirestore, 'users', userId);
      const oldDocRef = doc(collection(userDocRef, 'activityHistory'), oldDocId);
      deleteDoc(oldDocRef).catch((err) => {
        console.error('[activityHistoryRecompute] Failed to delete orphaned doc', oldDocId, err);
      });
    }
  }
}
