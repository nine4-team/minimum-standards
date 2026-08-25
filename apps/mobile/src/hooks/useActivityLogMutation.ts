import { useCallback } from 'react';
import { Standard } from '@minimum-standards/shared-model';
import { activityLogsService } from '../services/activityLogsService';
import { activityHistoryReconciliationService } from '../services/activityHistoryReconciliationService';
import { useAuthStore } from '../stores/authStore';
import { useActivityLogOperationStore } from '../stores/activityLogOperationStore';
import {
  ActivityLogOperation,
  ActivityLogWritePayload,
  classifyActivityLogError,
  resolveCreateReconciliation,
  shouldIgnoreOperationCompletion,
} from '../utils/activityLogMutations';
import { emitActivityLogMutation } from '../utils/activityLogEvents';

interface CreateInput {
  standardId: string;
  value: number;
  occurredAtMs: number;
  note?: string | null;
}

interface UpdateInput extends CreateInput {
  logEntryId: string;
}

interface DeleteInput {
  logEntryId: string;
  standardId: string;
  occurredAtMs: number;
}

type RestoreInput = DeleteInput;

type LogOperationInput =
  | { kind: 'create' | 'update'; payload: ActivityLogWritePayload }
  | { kind: 'delete' | 'restore'; payload: ActivityLogWritePayload };

function errorDetails(error: unknown): { code: string; message: string } {
  const value = error as { code?: string; message?: string };
  return {
    code: value?.code ?? 'firestore/unknown-error',
    message: value?.message ?? 'The activity log could not be synced.',
  };
}

function finishAcknowledgedOperation(
  operation: ActivityLogOperation,
  standard: Standard
): void {
  const store = useActivityLogOperationStore.getState();
  const current = store.operationsByLogId[operation.payload.id];
  if (
    shouldIgnoreOperationCompletion(
      current,
      operation.attemptId,
      operation.sequence
    )
  ) {
    return;
  }
  store.markSynced({
    logEntryId: operation.payload.id,
    attemptId: operation.attemptId,
    sequence: operation.sequence,
  });

  emitActivityLogMutation({
    type: operation.kind,
    standardId: operation.payload.standardId,
    activityId: standard.activityId,
    occurredAtMs: operation.payload.occurredAtMs,
    logEntryId: operation.payload.id,
  });

  activityHistoryReconciliationService
    .reconcilePeriod({
      userId: operation.payload.userId,
      standard,
      occurredAtMs: operation.payload.occurredAtMs,
    })
    .catch((error) => {
      console.error('[ActivityHistory] Reconciliation failed after acknowledged log write', {
        operationId: operation.operationId,
        errorCode: errorDetails(error).code,
      });
    });

  // Server-acknowledged payloads no longer need to retain user-entered notes in memory.
  store.discard(operation.payload.id);
}

export function useActivityLogMutation(standards: Standard[]) {
  const authStatus = useAuthStore((state) => state.status);
  const authenticatedUid = useAuthStore((state) => state.authenticatedUid);
  const authUserUid = useAuthStore((state) => state.user?.uid ?? null);

  const assertStableAuth = useCallback((): string => {
    if (
      authStatus !== 'authenticated' ||
      !authenticatedUid ||
      authUserUid !== authenticatedUid
    ) {
      throw new Error('Reconnecting your account. Keep this entry open and try again in a moment.');
    }
    return authenticatedUid;
  }, [authStatus, authenticatedUid, authUserUid]);

  const findLoggableStandard = useCallback(
    (standardId: string, verb: string): Standard => {
      const standard = standards.find((item) => item.id === standardId);
      if (!standard) {
        throw new Error('Standard not found');
      }
      if (standard.state !== 'active' || standard.archivedAtMs != null) {
        throw new Error(`This Standard is inactive. Activate it to ${verb} logs.`);
      }
      return standard;
    },
    [standards]
  );

  const reconcileAmbiguousCreate = useCallback(
    async (operation: ActivityLogOperation, standard: Standard) => {
      const store = useActivityLogOperationStore.getState();
      try {
        const serverDocument = await activityLogsService.getFromServer({
          userId: operation.payload.userId,
          logEntryId: operation.payload.id,
        });
        const result = resolveCreateReconciliation(operation.payload, serverDocument);
        if (result === 'matching') {
          finishAcknowledgedOperation(operation, standard);
        } else if (result === 'conflicting') {
          store.markConflict({
            logEntryId: operation.payload.id,
            attemptId: operation.attemptId,
            sequence: operation.sequence,
          });
        } else {
          store.markFailed({
            logEntryId: operation.payload.id,
            attemptId: operation.attemptId,
            sequence: operation.sequence,
            category: 'retryable',
            errorCode: 'firestore/confirmed-absent',
            errorMessage: 'This entry did not reach the server. Tap Retry to submit it again.',
          });
        }
      } catch {
        // A failed server-only read cannot prove absence. Keep the operation pending and
        // never replay the create blindly.
      }
    },
    []
  );

  const startOperation = useCallback(
    (input: LogOperationInput, standard: Standard): ActivityLogOperation => {
      const store = useActivityLogOperationStore.getState();
      const operation = store.register(input);
      let completion: Promise<void>;

      switch (input.kind) {
        case 'create':
          completion = activityLogsService.createOnce(input.payload);
          break;
        case 'update':
          completion = activityLogsService.update(input.payload);
          break;
        case 'delete':
          completion = activityLogsService.softDelete({
            userId: input.payload.userId,
            logEntryId: input.payload.id,
          });
          break;
        case 'restore':
          completion = activityLogsService.restore({
            userId: input.payload.userId,
            logEntryId: input.payload.id,
          });
          break;
      }

      store.markPending({
        logEntryId: input.payload.id,
        attemptId: operation.attemptId,
        sequence: operation.sequence,
      });

      completion.then(
        () => finishAcknowledgedOperation(operation, standard),
        (error) => {
          const category = classifyActivityLogError(error);
          if (input.kind === 'create' && category === 'ambiguous') {
            reconcileAmbiguousCreate(operation, standard).catch(() => undefined);
            return;
          }
          if (category === 'ambiguous') {
            // The write outcome is unknown. A retry could overwrite newer intent, so the
            // status remains pending until the native listener or a later refresh resolves it.
            return;
          }
          const details = errorDetails(error);
          store.markFailed({
            logEntryId: input.payload.id,
            attemptId: operation.attemptId,
            sequence: operation.sequence,
            category,
            errorCode: details.code,
            errorMessage: details.message,
          });
        }
      );

      return operation;
    },
    [reconcileAmbiguousCreate]
  );

  const createLogEntry = useCallback(
    async ({ standardId, value, occurredAtMs, note = null }: CreateInput) => {
      const userId = assertStableAuth();
      const standard = findLoggableStandard(standardId, 'resume logging');
      const logEntryId = activityLogsService.createDocumentId(userId);
      startOperation(
        {
          kind: 'create',
          payload: { id: logEntryId, userId, standardId, value, occurredAtMs, note },
        },
        standard
      );
      return { logEntryId };
    },
    [assertStableAuth, findLoggableStandard, startOperation]
  );

  const updateLogEntry = useCallback(
    async ({ logEntryId, standardId, value, occurredAtMs, note = null }: UpdateInput) => {
      const userId = assertStableAuth();
      const standard = findLoggableStandard(standardId, 'edit');
      startOperation(
        {
          kind: 'update',
          payload: { id: logEntryId, userId, standardId, value, occurredAtMs, note },
        },
        standard
      );
    },
    [assertStableAuth, findLoggableStandard, startOperation]
  );

  const deleteLogEntry = useCallback(
    async ({ logEntryId, standardId, occurredAtMs }: DeleteInput) => {
      const userId = assertStableAuth();
      const standard = findLoggableStandard(standardId, 'delete');
      startOperation(
        {
          kind: 'delete',
          payload: { id: logEntryId, userId, standardId, value: 0, occurredAtMs, note: null },
        },
        standard
      );
    },
    [assertStableAuth, findLoggableStandard, startOperation]
  );

  const restoreLogEntry = useCallback(
    async ({ logEntryId, standardId, occurredAtMs }: RestoreInput) => {
      const userId = assertStableAuth();
      const standard = findLoggableStandard(standardId, 'restore');
      startOperation(
        {
          kind: 'restore',
          payload: { id: logEntryId, userId, standardId, value: 0, occurredAtMs, note: null },
        },
        standard
      );
    },
    [assertStableAuth, findLoggableStandard, startOperation]
  );

  const retryActivityLogOperation = useCallback(
    async (logEntryId: string) => {
      const userId = assertStableAuth();
      const store = useActivityLogOperationStore.getState();
      const current = store.operationsByLogId[logEntryId];
      if (!current || current.payload.userId !== userId) {
        throw new Error('This entry is no longer available to retry.');
      }
      const standard = findLoggableStandard(current.payload.standardId, 'log');

      if (current.kind === 'create') {
        let serverDocument: ActivityLogWritePayload | null;
        try {
          serverDocument = await activityLogsService.getFromServer({ userId, logEntryId });
        } catch {
          // Retry remains disabled until a server-only read can prove the original
          // create is absent. This avoids an unhandled error and, more importantly,
          // avoids replaying an ambiguous create while offline.
          return;
        }
        const reconciliation = resolveCreateReconciliation(current.payload, serverDocument);
        if (reconciliation === 'matching') {
          finishAcknowledgedOperation(current, standard);
          return;
        }
        if (reconciliation === 'conflicting') {
          store.markConflict({
            logEntryId,
            attemptId: current.attemptId,
            sequence: current.sequence,
          });
          return;
        }
      }

      if (current.status !== 'failed-retryable') {
        return;
      }
      startOperation(
        { kind: current.kind, payload: current.payload } as LogOperationInput,
        standard
      );
    },
    [assertStableAuth, findLoggableStandard, startOperation]
  );

  return {
    createLogEntry,
    updateLogEntry,
    deleteLogEntry,
    restoreLogEntry,
    retryActivityLogOperation,
  };
}
