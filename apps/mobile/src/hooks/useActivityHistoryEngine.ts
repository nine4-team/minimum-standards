import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDocs,
} from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';
import { useStandards } from './useStandards';
import {
  Standard,
  calculatePeriodWindow,
  derivePeriodStatus,
  resolveEraForTimestamp,
  buildSnapshotFromEra,
  buildSnapshotFromStandard,
} from '@minimum-standards/shared-model';
import {
  writeActivityHistoryPeriod,
  getActivityHistoryDoc,
  getLatestHistoryForStandard,
} from '../utils/activityHistoryFirestore';

/**
 * Global Activity History Engine hook.
 * 
 * This hook automatically generates activityHistory documents for completed periods
 * of active standards. It runs independently of dashboard visibility.
 * 
 * Mount this hook once at the authenticated app root (e.g., BottomTabNavigator).
 */
export function useActivityHistoryEngine() {
  const { orderedActiveStandards } = useStandards();
  const userId = firebaseAuth.currentUser?.uid;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunningCatchUpRef = useRef(false);
  const hasRunInitialCatchUpRef = useRef(false);
  const previousStandardsLengthRef = useRef(0);

  /**
   * Computes rollups for a period window by querying logs.
   * minimumOverride allows callers to use an era-resolved minimum rather than
   * the standard's current minimum, preserving historical accuracy.
   */
  const computeRollupsForPeriod = useCallback(
    async (
      standard: Standard,
      window: { startMs: number; endMs: number },
      nowMs: number,
      minimumOverride?: number
    ) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Query logs for this standard in the period window
      const logsQuery = query(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        where('standardId', '==', standard.id),
        where('occurredAt', '>=', Timestamp.fromMillis(window.startMs)),
        where('occurredAt', '<', Timestamp.fromMillis(window.endMs))
      );

      const snapshot = await getDocs(logsQuery);
      const logs: Array<{ value: number }> = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Exclude soft-deleted logs
        if (data.deletedAt) {
          return;
        }
        if (typeof data.value === 'number' && data.occurredAt) {
          logs.push({ value: data.value });
        }
      });

      const total = Number.isFinite(logs.reduce((sum, log) => sum + log.value, 0))
        ? logs.reduce((sum, log) => sum + log.value, 0)
        : 0;
      const currentSessions = logs.length;
      const targetSessions = minimumOverride !== undefined
        ? standard.sessionConfig.sessionsPerCadence
        : standard.sessionConfig.sessionsPerCadence;
      const effectiveMinimum = minimumOverride ?? standard.minimum;
      const status = derivePeriodStatus(
        total,
        effectiveMinimum,
        nowMs,
        window.endMs
      );
      const safeMinimum = Math.max(effectiveMinimum, 0);
      const ratio = safeMinimum === 0 ? 1 : Math.min(total / safeMinimum, 1);
      const progressPercent = Number.isFinite(ratio)
        ? Number((ratio * 100).toFixed(2))
        : 0;

      return {
        total,
        currentSessions,
        targetSessions,
        status,
        progressPercent,
      };
    },
    [userId]
  );

  /**
   * Catch-up routine: generates history for all completed periods since the last generated period.
   */
  const runCatchUp = useCallback(
    async (source: 'boundary' | 'resume') => {
      console.log(`[useActivityHistoryEngine] Starting catch-up (${source}) for ${orderedActiveStandards.length} standards`);

      if (!userId || orderedActiveStandards.length === 0) {
        console.log('[useActivityHistoryEngine] Skipping catch-up: no user or standards');
        return;
      }

      // Prevent concurrent catch-up runs
      if (isRunningCatchUpRef.current) {
        console.log('[useActivityHistoryEngine] Catch-up already running, skipping');
        return;
      }

      isRunningCatchUpRef.current = true;
      const nowMs = Date.now();

      try {
        for (const standard of orderedActiveStandards) {
          console.log(`[useActivityHistoryEngine] Processing standard ${standard.id} (${standard.activityId})`);

          // Only process active standards
          if (standard.state !== 'active') {
            console.log(`[useActivityHistoryEngine] Skipping inactive standard ${standard.id}`);
            continue;
          }

          // Get latest history for this standard
          const latestHistory = await getLatestHistoryForStandard({
            userId,
            standardId: standard.id,
          });

          let lastCompletedWindow: ReturnType<typeof calculatePeriodWindow> | null = null;
          if (latestHistory) {
            const lastReference =
              latestHistory.referenceTimestampMs ?? latestHistory.periodStartMs;
            if (typeof lastReference === 'number') {
              lastCompletedWindow = calculatePeriodWindow(
                lastReference,
                latestHistory.standardSnapshot.cadence,
                timezone,
                { periodStartPreference: latestHistory.standardSnapshot.periodStartPreference }
              );
            }
          }

          console.log(
            `[useActivityHistoryEngine] Latest history for ${standard.id}:`,
            latestHistory
              ? lastCompletedWindow
                ? `ends at ${new Date(lastCompletedWindow.endMs).toISOString()}`
                : 'reference missing'
              : 'none'
          );

          // Determine starting reference time
          let startReference: number;
          if (latestHistory && lastCompletedWindow) {
            // Start from the end of the latest period (catch up from there)
            startReference = lastCompletedWindow.endMs;
          } else {
            // No history exists - try to find the earliest log for this standard
            const earliestLogQuery = query(
              collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
              where('standardId', '==', standard.id),
              orderBy('occurredAt', 'asc'),
              limit(1)
            );
            
            const earliestLogSnap = await getDocs(earliestLogQuery);
            
            if (!earliestLogSnap.empty) {
              // Found logs! Start backfill from the earliest log
              const logData = earliestLogSnap.docs[0].data();
              // Handle Timestamp or number just in case, though schema says Timestamp
              const occurredAt = logData.occurredAt;
              startReference = occurredAt instanceof Timestamp ? occurredAt.toMillis() : Date.now();
              console.log(`[useActivityHistoryEngine] No history found, but found logs starting at ${new Date(startReference).toISOString()}. Backfilling...`);
            } else {
              // No history and no logs - start from current period (no backfill)
              console.log(`[useActivityHistoryEngine] No history and no logs found for ${standard.id}. Starting fresh.`);
              const currentWindow = calculatePeriodWindow(
                nowMs,
                standard.cadence,
                timezone,
                { periodStartPreference: standard.periodStartPreference }
              );
              startReference = currentWindow.startMs;
            }
          }

          // Iterate forward through completed periods
          const maxIterations = 1000; // Safety limit
          let iterations = 0;
          let currentReference = startReference;

          console.log(`[useActivityHistoryEngine] Starting period iteration for ${standard.id} from ${new Date(startReference).toISOString()}`);

          while (iterations < maxIterations) {
            const window = calculatePeriodWindow(
              currentReference,
              standard.cadence,
              timezone,
              { periodStartPreference: standard.periodStartPreference }
            );

            console.log(`[useActivityHistoryEngine] Calculated window for ${standard.id}: ${new Date(window.startMs).toISOString()} to ${new Date(window.endMs).toISOString()}`);

            // Stop when we reach the current period (window includes now)
            if (window.startMs <= nowMs && window.endMs > nowMs) {
              console.log(`[useActivityHistoryEngine] Reached current period for ${standard.id}, stopping`);
              break;
            }

            // Only write for fully completed periods
            if (window.endMs <= nowMs) {
              console.log(`[useActivityHistoryEngine] Processing completed period for ${standard.id}: ${window.label}`);

              // Check-before-write: skip if a doc already exists to preserve its snapshot
              const existingDoc = await getActivityHistoryDoc({
                userId,
                activityId: standard.activityId,
                standardId: standard.id,
                periodStartMs: window.startMs,
              });
              if (existingDoc && !existingDoc.deletedAtMs) {
                console.log(`[useActivityHistoryEngine] Doc already exists for ${standard.id} at ${window.label}, skipping`);
                currentReference = window.endMs;
                iterations++;
                continue;
              }

              // Build era-resolved snapshot for new docs
              const era = resolveEraForTimestamp(standard, window.startMs);
              const standardSnapshot = era
                ? buildSnapshotFromEra(era)
                : buildSnapshotFromStandard(standard);

              // Compute rollups using the era-resolved minimum for historical accuracy
              const rollup = await computeRollupsForPeriod(
                standard,
                window,
                nowMs,
                era ? era.minimum : undefined
              );
              console.log(`[useActivityHistoryEngine] Computed rollup for ${standard.id}: ${rollup.total} total`);

              console.log(`[useActivityHistoryEngine] Writing history document for ${standard.id}`);
              await writeActivityHistoryPeriod({
                userId,
                activityId: standard.activityId,
                standardId: standard.id,
                window,
                standardSnapshot,
                rollup,
                source,
              });
              console.log(`[useActivityHistoryEngine] Successfully wrote history document for ${standard.id}`);

              // Move to next period after writing
              currentReference = window.endMs;
            } else {
              // Window hasn't completed yet, stop
              console.log(`[useActivityHistoryEngine] Period not completed yet for ${standard.id}, stopping`);
              break;
            }

            iterations++;
          }

          console.log(`[useActivityHistoryEngine] Finished processing ${standard.id} after ${iterations} iterations`);
        }
      } catch (error) {
        // Enhanced error logging to help diagnose stale bundle issues
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes('stale bundle') ||
            errorMessage.includes('invalid parameter') ||
            errorMessage.includes('firestore is required') ||
            errorMessage.includes('expected object')
          ) {
            console.error(
              '[useActivityHistoryEngine] STALE BUNDLE DETECTED: ' +
              'The error suggests you are running an old JS bundle. ' +
              'See troubleshooting/activity-history-engine-call-error.md for resolution steps.\n' +
              'Error:', error.message
            );
          } else {
            console.error('[useActivityHistoryEngine] Error during catch-up:', error);
          }
        } else {
          console.error('[useActivityHistoryEngine] Error during catch-up:', error);
        }
      } finally {
        isRunningCatchUpRef.current = false;
      }
    },
    [userId, orderedActiveStandards, timezone, computeRollupsForPeriod]
  );

  /**
   * Schedules a timer to the earliest next boundary across all active standards.
   */
  const scheduleNextBoundary = useCallback(() => {
    if (orderedActiveStandards.length === 0) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const nowMs = Date.now();
    let nextBoundaryMs: number | null = null;
    console.log(`[useActivityHistoryEngine] Calculating next boundary for ${orderedActiveStandards.length} standards`);

    // Find the earliest boundary across all active standards
      for (const standard of orderedActiveStandards) {
      if (standard.state !== 'active') {
        continue;
      }

        const window = calculatePeriodWindow(
          nowMs,
          standard.cadence,
          timezone,
          { periodStartPreference: standard.periodStartPreference }
        );
        console.log(`[useActivityHistoryEngine] Standard ${standard.id} next boundary: ${new Date(window.endMs).toISOString()}`);
      if (nextBoundaryMs === null || window.endMs < nextBoundaryMs) {
        nextBoundaryMs = window.endMs;
      }
    }

    console.log(`[useActivityHistoryEngine] Next boundary scheduled for: ${nextBoundaryMs ? new Date(nextBoundaryMs).toISOString() : 'none'}`);

    if (nextBoundaryMs === null) {
      return;
    }

    // If boundary already passed, run catch-up immediately
    if (nextBoundaryMs <= nowMs) {
      runCatchUp('boundary').then(() => {
        scheduleNextBoundary(); // Reschedule after catch-up
      });
      return;
    }

    const delayMs = nextBoundaryMs - nowMs;
    console.log(`[useActivityHistoryEngine] Scheduling boundary catch-up in ${delayMs}ms (at ${new Date(nextBoundaryMs).toISOString()})`);

    // Schedule timeout to trigger catch-up at boundary
    timeoutRef.current = setTimeout(() => {
      console.log('[useActivityHistoryEngine] Boundary timer fired, running catch-up');
      runCatchUp('boundary').then(() => {
        console.log('[useActivityHistoryEngine] Boundary catch-up completed');
        scheduleNextBoundary(); // Reschedule for next boundary
      });
    }, delayMs);
  }, [orderedActiveStandards, timezone, runCatchUp]);

  // Run catch-up on mount and when standards become available
  useEffect(() => {
    if (!userId) {
      hasRunInitialCatchUpRef.current = false;
      previousStandardsLengthRef.current = 0;
      return;
    }

    const previousLength = previousStandardsLengthRef.current;
    previousStandardsLengthRef.current = orderedActiveStandards.length;

    if (orderedActiveStandards.length === 0) {
      hasRunInitialCatchUpRef.current = false;
      return;
    }

    if (hasRunInitialCatchUpRef.current && previousLength > 0) {
      return;
    }

    console.log(`[useActivityHistoryEngine] Triggering initial catch-up for ${orderedActiveStandards.length} standards`);
    hasRunInitialCatchUpRef.current = true;
    runCatchUp('boundary').then(() => {
      console.log('[useActivityHistoryEngine] Initial catch-up completed, scheduling boundary timer');
      scheduleNextBoundary();
    });
  }, [userId, orderedActiveStandards.length, runCatchUp, scheduleNextBoundary]);

  // Schedule boundary timer when standards change
  useEffect(() => {
    scheduleNextBoundary();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [scheduleNextBoundary]);

  // Handle app resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && userId) {
        runCatchUp('resume').then(() => {
          scheduleNextBoundary();
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, runCatchUp, scheduleNextBoundary]);
}

