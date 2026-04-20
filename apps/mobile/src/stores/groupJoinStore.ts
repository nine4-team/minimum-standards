import { create } from 'zustand';

type GroupJoinState = {
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string) => void;
  clearPendingInviteCode: () => void;
};

export const useGroupJoinStore = create<GroupJoinState>((set) => ({
  pendingInviteCode: null,
  setPendingInviteCode: (code) => set({ pendingInviteCode: code }),
  clearPendingInviteCode: () => set({ pendingInviteCode: null }),
}));
