import { useEffect, useState, useRef } from 'react';
import {
  FirebaseFirestoreTypes,
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from '@react-native-firebase/firestore';
import { firebaseFirestore } from '../firebase/firebaseApp';
import { useAuthStore } from '../stores/authStore';
import {
  subscribeToActivityLogMutations,
  ActivityLogMutation,
} from '../utils/activityLogEvents';

export interface ActivityLogSlice {
  id: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
}

export interface UseActivityRangeLogsResult {
  logs: ActivityLogSlice[];
  loading: boolean;
  error: Error | null;
}

// TTL-backed cache for query results
// Keyed by userId + sorted standardIds + startMs + endMs
// Limited to last 5 queries to prevent memory issues
interface CacheEntry {
  logs: ActivityLogSlice[];
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 5;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function createCacheKey(userId: string, standardIds: string[], startMs: number, endMs: number): string {
  const sortedIds = [...standardIds].sort().join(',');
  return `${userId}:${sortedIds}:${startMs}:${endMs}`;
}

function getCachedResult(cacheKey: string): { logs: ActivityLogSlice[]; isFresh: boolean } | null {
  const entry = queryCache.get(cacheKey);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  const isFresh = age < CACHE_TTL_MS;
  
  if (!isFresh) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return { logs: entry.logs, isFresh };
}

function setCachedResult(cacheKey: string, logs: ActivityLogSlice[]): void {
  // Limit cache size by removing oldest entries
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(queryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    // Remove oldest entry
    queryCache.delete(entries[0][0]);
  }
  
  queryCache.set(cacheKey, {
    logs,
    timestamp: Date.now(),
  });
}

/**
 * Hook to fetch logs for a given set of standardIds within a date range.
 * This is useful for charts that need daily granularity across multiple periods.
 */
export function useActivityRangeLogs(
  standardIds: string[],
  startMs: number,
  endMs: number
): UseActivityRangeLogsResult {
  const userId = useAuthStore((state) => state.authenticatedUid);
  const prevCacheKeyRef = useRef<string | null>(null);
  const listenerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chunkResultsRef = useRef<Map<number, ActivityLogSlice[]>>(new Map());
  const standardIdsRef = useRef<string[]>(standardIds);
  const startMsRef = useRef(startMs);
  const endMsRef = useRef(endMs);
  const userIdRef = useRef(userId);
  const shouldUseListenersRef = useRef(shouldUseListeners);
  
  // Initialize from cache if available
  const initialCacheKey =
    userId && standardIds.length > 0
      ? createCacheKey(userId, standardIds, startMs, endMs)
      : null;
  const initialCached = initialCacheKey ? getCachedResult(initialCacheKey) : null;
  const initialCacheHasData =
    !!initialCached && Array.isArray(initialCached.logs) && initialCached.logs.length > 0;
  const initialCacheUsable = Boolean(initialCached?.isFresh && initialCacheHasData);

  // Track whether listeners should be active (false when using fresh cache with data)
  const [shouldUseListeners, setShouldUseListeners] = useState(!initialCacheUsable);

  const [logs, setLogs] = useState<ActivityLogSlice[]>(initialCached?.logs || []);
  const [loading, setLoading] = useState(!initialCacheUsable);
  const [error, setError] = useState<Error | null>(null);
  const prevShouldUseListenersRef = useRef(shouldUseListeners);

  useEffect(() => {
    standardIdsRef.current = standardIds;
  }, [standardIds]);

  useEffect(() => {
    startMsRef.current = startMs;
  }, [startMs]);

  useEffect(() => {
    endMsRef.current = endMs;
  }, [endMs]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    shouldUseListenersRef.current = shouldUseListeners;
  }, [shouldUseListeners]);

  useEffect(() => {
    if (!userId || standardIds.length === 0) {
      return;
    }

    const handleMutation = (mutation: ActivityLogMutation) => {
      const currentStandardIds = standardIdsRef.current;
      if (!currentStandardIds || currentStandardIds.length === 0) {
        return;
      }

      if (!currentStandardIds.includes(mutation.standardId)) {
        return;
      }

      const currentStart = startMsRef.current;
      const currentEnd = endMsRef.current;
      if (
        typeof currentStart !== 'number' ||
        typeof currentEnd !== 'number' ||
        mutation.occurredAtMs < currentStart ||
        mutation.occurredAtMs >= currentEnd
      ) {
        return;
      }

      const currentUserId = userIdRef.current;
      if (!currentUserId) {
        return;
      }

      const cacheKey = createCacheKey(
        currentUserId,
        currentStandardIds,
        currentStart,
        currentEnd
      );
      queryCache.delete(cacheKey);
      chunkResultsRef.current.clear();

      if (listenerTimeoutRef.current) {
        clearTimeout(listenerTimeoutRef.current);
        listenerTimeoutRef.current = null;
      }

      if (!shouldUseListenersRef.current) {
        setShouldUseListeners(true);
      } else {
        setLoading(true);
      }
    };

    const unsubscribe = subscribeToActivityLogMutations(handleMutation);
    return () => {
      unsubscribe();
    };
  }, [userId, standardIds.length]);

  useEffect(() => {
    const prevShouldUseListeners = prevShouldUseListenersRef.current;
    prevShouldUseListenersRef.current = shouldUseListeners;

    // When listeners are re-enabled (e.g., TTL expired), clear stale chunk data and mark as loading
    if (shouldUseListeners && !prevShouldUseListeners) {
      chunkResultsRef.current.clear();
      setLoading(true);
    }

    if (!userId || standardIds.length === 0) {
      setLoading(false);
      setLogs([]);
      setShouldUseListeners(false);
      prevCacheKeyRef.current = null;
      chunkResultsRef.current.clear();
      if (listenerTimeoutRef.current) {
        clearTimeout(listenerTimeoutRef.current);
        listenerTimeoutRef.current = null;
      }
      return;
    }

    const currentCacheKey = createCacheKey(userId, standardIds, startMs, endMs);
    const cached = getCachedResult(currentCacheKey);
    
    // If cache key changed, reset state
    if (currentCacheKey !== prevCacheKeyRef.current) {
      prevCacheKeyRef.current = currentCacheKey;
      chunkResultsRef.current.clear();
      
      if (listenerTimeoutRef.current) {
        clearTimeout(listenerTimeoutRef.current);
        listenerTimeoutRef.current = null;
      }
      
      if (cached) {
        const cacheLogs = Array.isArray(cached.logs) ? cached.logs : [];
        const cacheHasData = cacheLogs.length > 0;
        const cacheUsable = cached.isFresh && cacheHasData;

        setLogs(cacheLogs);
        setLoading(!cacheUsable);
        setError(null);
        
        if (cacheUsable) {
          setShouldUseListeners(false);
          const entry = queryCache.get(currentCacheKey);
          if (entry) {
            const age = Date.now() - entry.timestamp;
            const remainingTTL = CACHE_TTL_MS - age;
            listenerTimeoutRef.current = setTimeout(() => {
              listenerTimeoutRef.current = null;
              setShouldUseListeners(true);
            }, remainingTTL);
          }
        } else {
          setShouldUseListeners(true);
          setLoading(true);
        }
      } else {
        // No cache, set up listeners immediately
        setShouldUseListeners(true);
        setLoading(true);
        setError(null);
      }
    }

    // If we shouldn't use listeners yet (cache is fresh), skip listener setup
    if (!shouldUseListeners) {
      const currentCached = getCachedResult(currentCacheKey);
      const cacheHasData =
        !!currentCached && Array.isArray(currentCached.logs) && currentCached.logs.length > 0;
      if (currentCached?.isFresh && cacheHasData) {
        return () => {
          if (listenerTimeoutRef.current) {
            clearTimeout(listenerTimeoutRef.current);
            listenerTimeoutRef.current = null;
          }
        };
      }
      // Cache expired while we were waiting, enable listeners
      setShouldUseListeners(true);
    }

    // Firestore 'in' queries are limited to 10-30 values depending on version.
    // We chunk standardIds into groups of 10 and merge the results.
    const CHUNK_SIZE = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < standardIds.length; i += CHUNK_SIZE) {
      chunks.push(standardIds.slice(i, i + CHUNK_SIZE));
    }

    const unsubscribes = chunks.map((chunk, chunkIdx) => {
      const logsQuery = query(
        collection(doc(firebaseFirestore, 'users', userId), 'activityLogs'),
        where('standardId', 'in', chunk),
        where('occurredAt', '>=', Timestamp.fromMillis(startMs)),
        where('occurredAt', '<', Timestamp.fromMillis(endMs)),
        where('deletedAt', '==', null),
        orderBy('occurredAt', 'asc')
      );

      return onSnapshot(
        logsQuery,
        (snapshot: FirebaseFirestoreTypes.QuerySnapshot) => {
          const thisChunkLogs: ActivityLogSlice[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as {
              standardId?: string;
              value?: number;
              occurredAt?: FirebaseFirestoreTypes.Timestamp;
              deletedAt?: FirebaseFirestoreTypes.Timestamp | null;
            };

            if (
              !data ||
              typeof data.standardId !== 'string' ||
              typeof data.value !== 'number' ||
              !data.occurredAt ||
              data.deletedAt
            ) {
              return;
            }

            thisChunkLogs.push({
              id: docSnap.id,
              standardId: data.standardId,
              value: data.value,
              occurredAtMs: data.occurredAt.toMillis(),
            });
          });

          // Store this chunk's results
          chunkResultsRef.current.set(chunkIdx, thisChunkLogs);

          // Merge all chunks (including ones that haven't updated yet)
          const allChunkLogs: ActivityLogSlice[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const chunkLogs = chunkResultsRef.current.get(i);
            if (chunkLogs) {
              allChunkLogs.push(...chunkLogs);
            }
          }

          // Sort by occurredAtMs since chunks might have overlapping or non-sequential times
          const sorted = allChunkLogs.sort((a, b) => a.occurredAtMs - b.occurredAtMs);
          
          // Update cache on every chunk snapshot to keep it fresh
          const currentKey = createCacheKey(userId, standardIds, startMs, endMs);
          setCachedResult(currentKey, sorted);
          
          // Only mark loading as false once we have data from all chunks
          if (chunkResultsRef.current.size === chunks.length) {
            setLoading(false);
          }
          
          setLogs(sorted);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      if (listenerTimeoutRef.current) {
        clearTimeout(listenerTimeoutRef.current);
        listenerTimeoutRef.current = null;
      }
    };
  }, [userId, standardIds, startMs, endMs, shouldUseListeners]);

  return { logs, loading, error };
}
