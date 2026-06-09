import { useCallback, useEffect, useState } from 'react';
import type { DashboardLayoutPage } from '@minimum-standards/shared-model';
import { firebaseAuth } from '../firebase/firebaseApp';
import {
  DashboardLayoutSnapshot,
  saveDashboardLayout,
  saveDashboardLayoutAndPlacements,
  saveDashboardPlacements,
  subscribeToDashboardLayout,
} from '../services/dashboardLayoutService';
import type { DashboardPlacement } from '../utils/dashboardPages';

export type UseDashboardLayoutResult = {
  layout: DashboardLayoutSnapshot;
  loading: boolean;
  error: Error | null;
  saveLayout: (pages: DashboardLayoutPage[]) => Promise<void>;
  savePlacements: (placements: DashboardPlacement[]) => Promise<void>;
  saveLayoutAndPlacements: (
    pages: DashboardLayoutPage[],
    placements: DashboardPlacement[]
  ) => Promise<void>;
};

export function useDashboardLayout(): UseDashboardLayoutResult {
  const userId = firebaseAuth.currentUser?.uid;
  const [layout, setLayout] = useState<DashboardLayoutSnapshot>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLayout(null);
      setLoading(false);
      setError(new Error('User not authenticated'));
      return;
    }

    setLoading(true);
    setError(null);
    return subscribeToDashboardLayout(
      userId,
      (nextLayout) => {
        setLayout(nextLayout);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError);
        setLoading(false);
      }
    );
  }, [userId]);

  const saveLayout = useCallback(
    async (pages: DashboardLayoutPage[]) => {
      if (!userId) throw new Error('User not authenticated');
      await saveDashboardLayout(userId, pages);
    },
    [userId]
  );

  const savePlacements = useCallback(
    async (placements: DashboardPlacement[]) => {
      if (!userId) throw new Error('User not authenticated');
      await saveDashboardPlacements(userId, placements);
    },
    [userId]
  );

  const saveLayoutAndPlacements = useCallback(
    async (pages: DashboardLayoutPage[], placements: DashboardPlacement[]) => {
      if (!userId) throw new Error('User not authenticated');
      await saveDashboardLayoutAndPlacements(userId, pages, placements);
    },
    [userId]
  );

  return {
    layout,
    loading,
    error,
    saveLayout,
    savePlacements,
    saveLayoutAndPlacements,
  };
}
