import { callFunction } from './cloudFunctions';
import type { MemberDashboardData } from '../hooks/useMemberDashboard';
import type { MemberStandardDetailData } from '../hooks/useMemberStandardDetail';
import type { DashboardLayoutPage } from '@minimum-standards/shared-model';

function mapError(err: any): string {
  const code = err?.code;
  switch (code) {
    case 'functions/not-found':
      return 'Not found.';
    case 'functions/permission-denied':
      return 'You do not have permission.';
    case 'functions/already-exists':
      return 'Already exists.';
    case 'functions/resource-exhausted':
      return 'Limit reached.';
    case 'functions/failed-precondition':
      return err?.message || 'Precondition failed.';
    case 'functions/unavailable':
      return 'Cloud Functions not available. Please try again later.';
    default:
      return err?.message || 'Something went wrong.';
  }
}

export async function createGroup(
  name: string,
  displayName: string
): Promise<{ groupId: string; inviteCode: string }> {
  try {
    return await callFunction('createGroup', { name, displayName });
  } catch (err: any) {
    throw new Error(mapError(err));
  }
}

export async function joinGroup(
  inviteCode: string,
  displayName: string
): Promise<{ groupId: string }> {
  try {
    return await callFunction('joinGroup', { inviteCode, displayName });
  } catch (err: any) {
    const code = err?.code;
    if (code === 'functions/not-found') throw new Error('Invalid invite code.');
    if (code === 'functions/resource-exhausted') throw new Error('This group is full.');
    if (code === 'functions/already-exists') throw new Error('You are already in this group.');
    throw new Error(mapError(err));
  }
}

export async function leaveGroup(groupId: string): Promise<{ deleted: boolean }> {
  try {
    return await callFunction('leaveGroup', { groupId });
  } catch (err: any) {
    throw new Error(mapError(err));
  }
}

export async function removeMember(groupId: string, targetUid: string): Promise<void> {
  try {
    await callFunction('removeMember', { groupId, targetUid });
  } catch (err: any) {
    throw new Error(mapError(err));
  }
}

export async function transferAdmin(groupId: string, newAdminUid: string): Promise<void> {
  try {
    await callFunction('transferAdmin', { groupId, newAdminUid });
  } catch (err: any) {
    throw new Error(mapError(err));
  }
}

export async function getMemberDashboard(groupId: string): Promise<MemberDashboardData> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    return await callFunction<MemberDashboardData>('getMemberDashboard', { groupId, timezone });
  } catch (err: any) {
    const code = err?.code;
    if (code === 'functions/not-found') throw new Error('Group not found.');
    if (code === 'functions/permission-denied') throw new Error('You are not a member of this group.');
    throw new Error(mapError(err));
  }
}

export interface MemberStandardSummary {
  id: string;
  name: string;
  notes: string | null;
  summary: string;
  minimum: number;
  unit: string;
  cadence: { interval: number; unit: 'day' | 'week' | 'month' };
  sessionConfig: { sessionLabel: string; sessionsPerCadence: number; volumePerSession: number } | null;
  periodStartPreference?: { mode: 'default' | 'weekDay'; weekStartDay?: number };
  dashboardPageId?: string;
  dashboardOrderIndex?: number;
  status: string;
  progressPercent: number;
  total: number;
  periodStartMs?: number;
  periodEndMs?: number;
}

export async function getMemberStandards(
  groupId: string,
  memberUid: string
): Promise<{ pages?: DashboardLayoutPage[]; standards: MemberStandardSummary[] }> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    return await callFunction('getMemberStandards', { groupId, memberUid, timezone });
  } catch (err: any) {
    const code = err?.code;
    if (code === 'functions/not-found') throw new Error('Group not found.');
    if (code === 'functions/permission-denied') throw new Error('You are not a member of this group.');
    throw new Error(mapError(err));
  }
}

export async function getMemberStandardDetail(
  groupId: string,
  memberUid: string,
  standardId: string
): Promise<MemberStandardDetailData> {
  try {
    return await callFunction<MemberStandardDetailData>('getMemberStandardDetail', {
      groupId,
      memberUid,
      standardId,
    });
  } catch (err: any) {
    const code = err?.code;
    if (code === 'functions/permission-denied') throw new Error('This standard is hidden from the group.');
    if (code === 'functions/not-found') throw new Error('Standard not found.');
    throw new Error(mapError(err));
  }
}

export async function updateDisplayName(displayName: string): Promise<void> {
  try {
    await callFunction('updateDisplayName', { displayName });
  } catch (err: any) {
    throw new Error(mapError(err));
  }
}
