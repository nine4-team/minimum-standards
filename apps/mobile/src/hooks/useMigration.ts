import { useEffect, useRef } from 'react';
import { firebaseAuth } from '../firebase/firebaseApp';
import { migrateActivitiesToStandards } from '../utils/migrateActivitiesToStandards';

/**
 * Runs one-time data migrations on app start.
 * Mount at the authenticated app root (e.g., BottomTabNavigator).
 */
export function useMigration() {
  const hasRun = useRef(false);

  useEffect(() => {
    const userId = firebaseAuth.currentUser?.uid;
    if (!userId || hasRun.current) return;
    hasRun.current = true;

    migrateActivitiesToStandards(userId).catch((err) => {
      console.error('[useMigration] Migration failed:', err);
    });
  }, []);
}
