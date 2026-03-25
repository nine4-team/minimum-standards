import { create } from 'zustand';

type SnapshotShareState = {
  pendingShareCode: string | null;
  /** Share codes that have already been processed (imported or shown error) this session. */
  processedShareCodes: Set<string>;
  setPendingShareCode: (shareCode: string) => void;
  clearPendingShareCode: () => void;
  markProcessed: (shareCode: string) => void;
  isProcessed: (shareCode: string) => boolean;
};

export const useSnapshotShareStore = create<SnapshotShareState>((set, get) => ({
  pendingShareCode: null,
  processedShareCodes: new Set(),
  setPendingShareCode: (shareCode) => {
    if (get().processedShareCodes.has(shareCode)) {
      return;
    }
    set({ pendingShareCode: shareCode });
  },
  clearPendingShareCode: () => {
    set({ pendingShareCode: null });
  },
  markProcessed: (shareCode) => {
    set((state) => {
      const next = new Set(state.processedShareCodes);
      next.add(shareCode);
      return { processedShareCodes: next };
    });
  },
  isProcessed: (shareCode) => {
    return get().processedShareCodes.has(shareCode);
  },
}));
