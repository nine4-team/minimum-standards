import { useCallback, useEffect, useState } from 'react';
import * as groupsService from '../services/groupsService';

export interface MemberStandardData {
  id: string;
  name: string;
  minimum: number;
  unit: string;
  cadence: { interval: number; unit: string };
  state: string;
  summary: string;
  sessionConfig: {
    sessionLabel: string;
    sessionsPerCadence: number;
    volumePerSession: number;
  };
}

export interface MemberPeriodHistory {
  id: string;
  periodStartMs: number;
  periodEndMs: number;
  periodLabel?: string;
  periodKey?: string;
  status: string;
  progressPercent: number;
  total: number;
  currentSessions: number;
  targetSessions: number;
  standardSnapshot?: any;
}

export interface MemberStandardDetailData {
  standard: MemberStandardData;
  history: MemberPeriodHistory[];
}

export function useMemberStandardDetail(
  groupId: string | null,
  memberUid: string | null,
  standardId: string | null
) {
  const [data, setData] = useState<MemberStandardDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!groupId || !memberUid || !standardId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await groupsService.getMemberStandardDetail(groupId, memberUid, standardId);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load standard details.');
    } finally {
      setLoading(false);
    }
  }, [groupId, memberUid, standardId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
