import { useEffect, useRef } from 'react';
import { firebaseAuth } from '../firebase/firebaseApp';
import { migrateActivitiesToStandards } from '../utils/migrateActivitiesToStandards';
import { reconcileActivityMetadata } from '../utils/reconcileActivityMetadata';
import { migrateCategoryIdCleanup } from '../utils/migrateCategoryIdCleanup';

/**
 * Runs data migrations on app start. Mount at the authenticated app root.
 * The one-shot migration runs first; reconcileActivityMetadata then catches
 * any ongoing writes from pre-Activity-elimination TestFlight clients.
 */
export function useMigration() {
  const hasRun = useRef(false);

  useEffect(() => {
    const userId = firebaseAuth.currentUser?.uid;
    if (!userId || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        await migrateActivitiesToStandards(userId);
      } catch (err) {
        console.error('[useMigration] One-shot migration failed:', err);
      }
      try {
        await migrateCategoryIdCleanup(userId);
      } catch (err) {
        console.error('[useMigration] categoryId cleanup failed:', err);
      }
      try {
        await reconcileActivityMetadata(userId);
      } catch (err) {
        console.error('[useMigration] Activity reconcile failed:', err);
      }
    })();
  }, []);
}
