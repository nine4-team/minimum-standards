import { useCallback, useEffect, useState } from 'react';
import * as groupsService from '../services/groupsService';

export interface MemberStats {
  metCount: number;
  totalCount: number;
  avgCompletion: number;
}

export interface MemberDashboardEntry {
  uid: string;
  displayName: string;
  joinedAtMs: number;
  isAdmin: boolean;
  stats: MemberStats;
}

export interface MemberDashboardData {
  groupId: string;
  groupName: string;
  inviteCode: string;
  adminUid: string;
  members: MemberDashboardEntry[];
}

export function useMemberDashboard(groupId: string | null) {
  const [data, setData] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!groupId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await groupsService.getMemberDashboard(groupId);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load group data.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
