export type ActivityLogMutationKind = 'create' | 'update' | 'delete' | 'restore';

export type ActivityLogOperationStatus =
  | 'attempting'
  | 'pending'
  | 'synced'
  | 'failed-retryable'
  | 'failed-permanent'
  | 'conflict'
  | 'undone';

export interface ActivityLogWritePayload {
  id: string;
  userId: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
  note: string | null;
}

export interface ActivityLogOperation {
  operationId: string;
  attemptId: string;
  sequence: number;
  kind: ActivityLogMutationKind;
  status: ActivityLogOperationStatus;
  payload: ActivityLogWritePayload;
  createdAtMs: number;
  updatedAtMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export type ActivityLogErrorCategory =
  | 'ambiguous'
  | 'auth-recoverable'
  | 'permission-permanent'
  | 'validation-permanent'
  | 'retryable'
  | 'permanent';

export type CreateReconciliation = 'matching' | 'absent' | 'conflicting';

export interface ActivityLogListenerRow {
  id: string;
  hasPendingWrites?: boolean;
}

export type DecoratedActivityLog<T extends ActivityLogListenerRow> = T & {
  syncStatus: 'pending' | 'synced';
};

type ErrorLike = { code?: string; message?: string };

function normalizeCode(error: unknown): string {
  const raw = (error as ErrorLike | null)?.code ?? '';
  return raw.startsWith('firestore/') ? raw : raw ? `firestore/${raw}` : 'firestore/unknown-error';
}

export function classifyActivityLogError(error: unknown): ActivityLogErrorCategory {
  const code = normalizeCode(error);

  if (code === 'firestore/unauthenticated') {
    return 'auth-recoverable';
  }
  if (code === 'firestore/permission-denied') {
    return 'permission-permanent';
  }
  if (
    code === 'firestore/invalid-argument' ||
    code === 'firestore/out-of-range' ||
    code === 'firestore/failed-precondition'
  ) {
    return 'validation-permanent';
  }
  if (code === 'firestore/aborted' || code === 'firestore/resource-exhausted') {
    return 'retryable';
  }
  if (
    code === 'firestore/unavailable' ||
    code === 'firestore/deadline-exceeded' ||
    code === 'firestore/internal' ||
    code === 'firestore/cancelled' ||
    code === 'firestore/unknown-error'
  ) {
    return 'ambiguous';
  }
  return 'permanent';
}

export function resolveCreateReconciliation(
  expected: ActivityLogWritePayload,
  actual: ActivityLogWritePayload | null
): CreateReconciliation {
  if (actual === null) {
    return 'absent';
  }

  return expected.id === actual.id &&
    expected.userId === actual.userId &&
    expected.standardId === actual.standardId &&
    expected.value === actual.value &&
    expected.occurredAtMs === actual.occurredAtMs &&
    expected.note === actual.note
    ? 'matching'
    : 'conflicting';
}

/**
 * Joins status onto Firestore rows without adding, removing, or replacing a data row.
 * Firestore remains the sole source for values and totals.
 */
export function decorateActivityLogsWithOperationStatus<T extends ActivityLogListenerRow>(
  rows: T[],
  operations: Record<string, ActivityLogOperation>
): DecoratedActivityLog<T>[] {
  return rows.map((row) => {
    const operation = operations[row.id];
    const operationPending =
      operation?.status === 'attempting' || operation?.status === 'pending';
    return {
      ...row,
      syncStatus: row.hasPendingWrites || operationPending ? 'pending' : 'synced',
    };
  });
}

export function shouldIgnoreOperationCompletion(
  current: ActivityLogOperation | undefined,
  attemptId: string,
  sequence: number
): boolean {
  return !current || current.attemptId !== attemptId || current.sequence !== sequence;
}
