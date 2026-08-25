import { create } from 'zustand';
import {
  ActivityLogErrorCategory,
  ActivityLogMutationKind,
  ActivityLogOperation,
  ActivityLogWritePayload,
  shouldIgnoreOperationCompletion,
} from '../utils/activityLogMutations';

interface RegisterOperationInput {
  kind: ActivityLogMutationKind;
  payload: ActivityLogWritePayload;
  nowMs?: number;
}

interface CompleteAttemptInput {
  logEntryId: string;
  attemptId: string;
  sequence: number;
  nowMs?: number;
}

interface FailAttemptInput extends CompleteAttemptInput {
  category: ActivityLogErrorCategory;
  errorCode: string;
  errorMessage: string;
}

interface ActivityLogOperationState {
  operationsByLogId: Record<string, ActivityLogOperation>;
  register: (input: RegisterOperationInput) => ActivityLogOperation;
  beginRetry: (logEntryId: string, nowMs?: number) => ActivityLogOperation | null;
  markPending: (input: CompleteAttemptInput) => void;
  markSynced: (input: CompleteAttemptInput) => void;
  markConflict: (input: CompleteAttemptInput) => void;
  markFailed: (input: FailAttemptInput) => void;
  requestUndo: (logEntryId: string, nowMs?: number) => void;
  discard: (logEntryId: string) => void;
  clearForUser: (userId: string) => void;
  clearAll: () => void;
}

let idCounter = 0;

function nextAttemptId(logEntryId: string): string {
  idCounter += 1;
  return `${logEntryId}:${Date.now()}:${idCounter}`;
}

function errorStatus(category: ActivityLogErrorCategory) {
  return category === 'retryable' || category === 'auth-recoverable'
    ? ('failed-retryable' as const)
    : ('failed-permanent' as const);
}

export const useActivityLogOperationStore = create<ActivityLogOperationState>((set, get) => ({
  operationsByLogId: {},

  register: ({ kind, payload, nowMs = Date.now() }) => {
    const previous = get().operationsByLogId[payload.id];
    const sequence = (previous?.sequence ?? 0) + 1;
    const attemptId = nextAttemptId(payload.id);
    const operation: ActivityLogOperation = {
      operationId: `${payload.id}:${sequence}`,
      attemptId,
      sequence,
      kind,
      status: 'attempting',
      payload,
      createdAtMs: previous?.createdAtMs ?? nowMs,
      updatedAtMs: nowMs,
    };
    set((state) => ({
      operationsByLogId: {
        ...state.operationsByLogId,
        [payload.id]: operation,
      },
    }));
    return operation;
  },

  beginRetry: (logEntryId, nowMs = Date.now()) => {
    const current = get().operationsByLogId[logEntryId];
    if (!current || current.status !== 'failed-retryable') {
      return null;
    }
    return get().register({
      kind: current.kind,
      payload: current.payload,
      nowMs,
    });
  },

  markPending: ({ logEntryId, attemptId, sequence, nowMs = Date.now() }) => {
    set((state) => {
      const current = state.operationsByLogId[logEntryId];
      if (shouldIgnoreOperationCompletion(current, attemptId, sequence)) {
        return state;
      }
      return {
        operationsByLogId: {
          ...state.operationsByLogId,
          [logEntryId]: { ...current, status: 'pending', updatedAtMs: nowMs },
        },
      };
    });
  },

  markSynced: ({ logEntryId, attemptId, sequence, nowMs = Date.now() }) => {
    set((state) => {
      const current = state.operationsByLogId[logEntryId];
      if (shouldIgnoreOperationCompletion(current, attemptId, sequence)) {
        return state;
      }
      return {
        operationsByLogId: {
          ...state.operationsByLogId,
          [logEntryId]: {
            ...current,
            status: 'synced',
            updatedAtMs: nowMs,
            errorCode: undefined,
            errorMessage: undefined,
          },
        },
      };
    });
  },

  markConflict: ({ logEntryId, attemptId, sequence, nowMs = Date.now() }) => {
    set((state) => {
      const current = state.operationsByLogId[logEntryId];
      if (shouldIgnoreOperationCompletion(current, attemptId, sequence)) {
        return state;
      }
      return {
        operationsByLogId: {
          ...state.operationsByLogId,
          [logEntryId]: { ...current, status: 'conflict', updatedAtMs: nowMs },
        },
      };
    });
  },

  markFailed: ({
    logEntryId,
    attemptId,
    sequence,
    category,
    errorCode,
    errorMessage,
    nowMs = Date.now(),
  }) => {
    set((state) => {
      const current = state.operationsByLogId[logEntryId];
      if (shouldIgnoreOperationCompletion(current, attemptId, sequence)) {
        return state;
      }
      return {
        operationsByLogId: {
          ...state.operationsByLogId,
          [logEntryId]: {
            ...current,
            status: errorStatus(category),
            updatedAtMs: nowMs,
            errorCode,
            errorMessage,
          },
        },
      };
    });
  },

  requestUndo: (logEntryId, nowMs = Date.now()) => {
    set((state) => {
      const current = state.operationsByLogId[logEntryId];
      if (!current) {
        return state;
      }
      return {
        operationsByLogId: {
          ...state.operationsByLogId,
          [logEntryId]: { ...current, status: 'undone', updatedAtMs: nowMs },
        },
      };
    });
  },

  discard: (logEntryId) => {
    set((state) => {
      const remaining = { ...state.operationsByLogId };
      delete remaining[logEntryId];
      return { operationsByLogId: remaining };
    });
  },

  clearForUser: (userId) => {
    set((state) => ({
      operationsByLogId: Object.fromEntries(
        Object.entries(state.operationsByLogId).filter(
          ([, operation]) => operation.payload.userId !== userId
        )
      ),
    }));
  },

  clearAll: () => set({ operationsByLogId: {} }),
}));
