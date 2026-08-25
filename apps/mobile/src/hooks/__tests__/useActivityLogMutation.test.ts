import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useActivityLogMutation } from '../useActivityLogMutation';
import { useAuthStore } from '../../stores/authStore';
import { useActivityLogOperationStore } from '../../stores/activityLogOperationStore';
import { activityLogsService } from '../../services/activityLogsService';
import { activityHistoryReconciliationService } from '../../services/activityHistoryReconciliationService';

jest.mock('../../services/activityLogsService', () => ({
  activityLogsService: {
    createDocumentId: jest.fn(() => 'log-1'),
    createOnce: jest.fn(),
    getFromServer: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  },
}));

jest.mock('../../services/activityHistoryReconciliationService', () => ({
  activityHistoryReconciliationService: {
    reconcilePeriod: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/activityLogEvents', () => ({
  emitActivityLogMutation: jest.fn(),
}));

const standard = {
  id: 'standard-1',
  name: 'Work',
  notes: null,
  activityId: 'activity-1',
  minimum: 10,
  unit: 'hours',
  cadence: { interval: 1, unit: 'week' },
  state: 'active',
  summary: '10 hours / week',
  archivedAtMs: null,
  createdAtMs: 1,
  updatedAtMs: 1,
  deletedAtMs: null,
  sessionConfig: {
    sessionLabel: 'session',
    sessionsPerCadence: 1,
    volumePerSession: 10,
  },
} as any;

describe('useActivityLogMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivityLogOperationStore.getState().clearAll();
    useAuthStore.getState().setUser({ uid: 'user-1' } as any);
  });

  it('returns the deterministic log id without awaiting server acknowledgement', async () => {
    let acknowledge: () => void = () => undefined;
    (activityLogsService.createOnce as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      })
    );

    const { result } = renderHook(() => useActivityLogMutation([standard]));
    let response: { logEntryId: string } | undefined;

    await act(async () => {
      response = await result.current.createLogEntry({
        standardId: 'standard-1',
        value: 6,
        occurredAtMs: 1234,
      });
    });

    expect(response).toEqual({ logEntryId: 'log-1' });
    expect(useActivityLogOperationStore.getState().operationsByLogId['log-1'].status).toBe(
      'pending'
    );
    expect(activityHistoryReconciliationService.reconcilePeriod).not.toHaveBeenCalled();

    acknowledge();
    await waitFor(() => {
      expect(useActivityLogOperationStore.getState().operationsByLogId['log-1']).toBeUndefined();
    });
    expect(activityHistoryReconciliationService.reconcilePeriod).toHaveBeenCalledTimes(1);
  });

  it('gates submission while auth is recovering and preserves the caller draft', async () => {
    useAuthStore.setState({
      status: 'recovering',
      authenticatedUid: null,
      recoveryUid: 'user-1',
    });
    const { result } = renderHook(() => useActivityLogMutation([standard]));

    await expect(
      result.current.createLogEntry({
        standardId: 'standard-1',
        value: 6,
        occurredAtMs: 1234,
      })
    ).rejects.toThrow('Reconnecting your account');
    expect(activityLogsService.createOnce).not.toHaveBeenCalled();
    expect(useActivityLogOperationStore.getState().operationsByLogId).toEqual({});
  });

  it('reconciles an ambiguous create by server ID without replaying it', async () => {
    (activityLogsService.createOnce as jest.Mock).mockRejectedValue({
      code: 'firestore/unavailable',
    });
    (activityLogsService.getFromServer as jest.Mock).mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      standardId: 'standard-1',
      value: 6,
      occurredAtMs: 1234,
      note: null,
    });
    const { result } = renderHook(() => useActivityLogMutation([standard]));

    await act(async () => {
      await result.current.createLogEntry({
        standardId: 'standard-1',
        value: 6,
        occurredAtMs: 1234,
      });
    });

    await waitFor(() => {
      expect(activityLogsService.getFromServer).toHaveBeenCalledWith({
        userId: 'user-1',
        logEntryId: 'log-1',
      });
      expect(activityHistoryReconciliationService.reconcilePeriod).toHaveBeenCalledTimes(1);
    });
    expect(activityLogsService.createOnce).toHaveBeenCalledTimes(1);
    expect(useActivityLogOperationStore.getState().operationsByLogId['log-1']).toBeUndefined();
  });
});
