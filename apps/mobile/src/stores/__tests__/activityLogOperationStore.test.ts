import { useActivityLogOperationStore } from '../activityLogOperationStore';

const payload = {
  id: 'log-1',
  userId: 'user-1',
  standardId: 'standard-1',
  value: 6,
  occurredAtMs: 1234,
  note: null,
};

describe('activityLogOperationStore', () => {
  beforeEach(() => {
    useActivityLogOperationStore.getState().clearAll();
  });

  it('ignores a stale completion after a newer operation is registered', () => {
    const first = useActivityLogOperationStore.getState().register({
      kind: 'create',
      payload,
      nowMs: 1,
    });
    const second = useActivityLogOperationStore.getState().register({
      kind: 'update',
      payload: { ...payload, value: 7 },
      nowMs: 2,
    });

    useActivityLogOperationStore.getState().markSynced({
      logEntryId: payload.id,
      attemptId: first.attemptId,
      sequence: first.sequence,
      nowMs: 3,
    });

    expect(useActivityLogOperationStore.getState().operationsByLogId[payload.id]).toMatchObject({
      attemptId: second.attemptId,
      status: 'attempting',
      payload: { value: 7 },
    });
  });

  it('keeps retry payloads scoped to their originating user', () => {
    const operation = useActivityLogOperationStore.getState().register({
      kind: 'create',
      payload,
    });
    useActivityLogOperationStore.getState().markFailed({
      logEntryId: payload.id,
      attemptId: operation.attemptId,
      sequence: operation.sequence,
      category: 'retryable',
      errorCode: 'firestore/aborted',
      errorMessage: 'Try again',
    });

    useActivityLogOperationStore.getState().clearForUser('user-1');

    expect(useActivityLogOperationStore.getState().operationsByLogId).toEqual({});
  });
});
