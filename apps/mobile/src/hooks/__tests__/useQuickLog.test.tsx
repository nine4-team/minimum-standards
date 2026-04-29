import { renderHook, act } from '@testing-library/react-native';
import { useQuickLog } from '../useQuickLog';

const mockCreateLogEntry = jest.fn();
const mockDeleteLogEntry = jest.fn();

jest.mock('../useStandards', () => ({
  useStandards: () => ({
    createLogEntry: mockCreateLogEntry,
    deleteLogEntry: mockDeleteLogEntry,
  }),
}));

const createLogEntry = mockCreateLogEntry;
const deleteLogEntry = mockDeleteLogEntry;

describe('useQuickLog', () => {
  beforeEach(() => {
    createLogEntry.mockReset();
    deleteLogEntry.mockReset();
  });

  it('calls createLogEntry with the default quantity and returns the new log id', async () => {
    createLogEntry.mockResolvedValue({ logEntryId: 'log-1' });

    const { result } = renderHook(() => useQuickLog());

    let outcome: { logEntryId: string; occurredAtMs: number } | null = null;
    await act(async () => {
      outcome = await result.current.quickLog({
        id: 'std-1',
        defaultQuantity: 5,
      });
    });

    expect(createLogEntry).toHaveBeenCalledTimes(1);
    expect(createLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        standardId: 'std-1',
        value: 5,
        note: null,
      }),
    );
    expect(outcome).not.toBeNull();
    expect(outcome!.logEntryId).toBe('log-1');
    expect(typeof outcome!.occurredAtMs).toBe('number');
  });

  it('returns null and does not call createLogEntry when no defaultQuantity is set', async () => {
    const { result } = renderHook(() => useQuickLog());

    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await result.current.quickLog({ id: 'std-2' });
    });

    expect(outcome).toBeNull();
    expect(createLogEntry).not.toHaveBeenCalled();
  });

  it('undo calls deleteLogEntry with the id and timestamp returned by quickLog', async () => {
    createLogEntry.mockResolvedValue({ logEntryId: 'log-9' });
    deleteLogEntry.mockResolvedValue(undefined);

    const { result } = renderHook(() => useQuickLog());

    let outcome: { logEntryId: string; occurredAtMs: number } | null = null;
    await act(async () => {
      outcome = await result.current.quickLog({
        id: 'std-3',
        defaultQuantity: 2,
      });
    });

    await act(async () => {
      await result.current.undoQuickLog(
        'std-3',
        outcome!.logEntryId,
        outcome!.occurredAtMs,
      );
    });

    expect(deleteLogEntry).toHaveBeenCalledWith({
      standardId: 'std-3',
      logEntryId: 'log-9',
      occurredAtMs: outcome!.occurredAtMs,
    });
  });
});
