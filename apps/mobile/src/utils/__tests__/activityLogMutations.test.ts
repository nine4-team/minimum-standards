import {
  ActivityLogOperation,
  classifyActivityLogError,
  decorateActivityLogsWithOperationStatus,
  resolveCreateReconciliation,
  shouldIgnoreOperationCompletion,
} from '../activityLogMutations';

const payload = {
  id: 'log-1',
  userId: 'user-1',
  standardId: 'standard-1',
  value: 6,
  occurredAtMs: 1234,
  note: null,
};

const operation: ActivityLogOperation = {
  operationId: 'operation-1',
  attemptId: 'attempt-1',
  sequence: 1,
  kind: 'create',
  status: 'pending',
  payload,
  createdAtMs: 1,
  updatedAtMs: 1,
};

describe('activityLogMutations', () => {
  it.each([
    ['permission-denied', 'permission-permanent'],
    ['firestore/unauthenticated', 'auth-recoverable'],
    ['unavailable', 'ambiguous'],
    ['firestore/deadline-exceeded', 'ambiguous'],
    ['aborted', 'retryable'],
    ['invalid-argument', 'validation-permanent'],
  ])('classifies %s as %s', (code, category) => {
    expect(classifyActivityLogError({ code })).toBe(category);
  });

  it('reconciles matching, absent, and conflicting creates', () => {
    expect(resolveCreateReconciliation(payload, { ...payload })).toBe('matching');
    expect(resolveCreateReconciliation(payload, null)).toBe('absent');
    expect(resolveCreateReconciliation(payload, { ...payload, value: 7 })).toBe('conflicting');
  });

  it('decorates listener rows without manufacturing or changing data', () => {
    const rows = [
      { id: 'log-1', value: 6, hasPendingWrites: false },
      { id: 'log-2', value: 0.5, hasPendingWrites: true },
    ];
    const decorated = decorateActivityLogsWithOperationStatus(rows, {
      'log-1': operation,
    });

    expect(decorated).toHaveLength(2);
    expect(decorated.map((row) => row.value)).toEqual([6, 0.5]);
    expect(decorated.map((row) => row.syncStatus)).toEqual(['pending', 'pending']);
  });

  it('ignores stale completions for an older attempt or sequence', () => {
    expect(shouldIgnoreOperationCompletion(operation, 'attempt-old', 1)).toBe(true);
    expect(shouldIgnoreOperationCompletion(operation, 'attempt-1', 0)).toBe(true);
    expect(shouldIgnoreOperationCompletion(operation, 'attempt-1', 1)).toBe(false);
  });
});
