import { useCallback } from 'react';
import type { Standard } from '@minimum-standards/shared-model';
import { useStandards } from './useStandards';
import { buildLogEntryFromDefault } from '../utils/buildLogEntryFromDefault';

export interface QuickLogResult {
  logEntryId: string;
  occurredAtMs: number;
}

export interface UseQuickLogResult {
  /**
   * Log the standard's defaultQuantity. Returns the new log entry id and
   * timestamp for undo, or null if the standard has no defaultQuantity set.
   */
  quickLog: (
    standard: Pick<Standard, 'id' | 'defaultQuantity'>,
  ) => Promise<QuickLogResult | null>;
  /** Undo a quick-log by deleting the entry it created. */
  undoQuickLog: (
    standardId: string,
    logEntryId: string,
    occurredAtMs: number,
  ) => Promise<void>;
}

/**
 * Wraps create / delete log mutations for the dashboard quick-log chip.
 * UI state (toast/undo timing) lives in the consumer; this hook is just I/O.
 */
export function useQuickLog(): UseQuickLogResult {
  const { createLogEntry, deleteLogEntry } = useStandards();

  const quickLog = useCallback(
    async (standard: Pick<Standard, 'id' | 'defaultQuantity'>) => {
      const payload = buildLogEntryFromDefault(standard, Date.now());
      if (!payload) {
        return null;
      }
      const { logEntryId } = await createLogEntry(payload);
      return { logEntryId, occurredAtMs: payload.occurredAtMs };
    },
    [createLogEntry],
  );

  const undoQuickLog = useCallback(
    async (standardId: string, logEntryId: string, occurredAtMs: number) => {
      await deleteLogEntry({ standardId, logEntryId, occurredAtMs });
    },
    [deleteLogEntry],
  );

  return { quickLog, undoQuickLog };
}
