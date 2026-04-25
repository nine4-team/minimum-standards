import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export interface WaitForNavigationReadyOptions {
  timeoutMs?: number;
  intervalMs?: number;
  isReady?: () => boolean;
  now?: () => number;
  setTimeoutFn?: (cb: () => void, ms: number) => unknown;
}

/**
 * Resolves once the NavigationContainer is mounted and ready to dispatch
 * actions, or after `timeoutMs` (returns false on timeout).
 *
 * Pure with respect to its dependencies — `isReady`, `now`, and `setTimeoutFn`
 * can be injected for tests.
 */
export function waitForNavigationReady(
  options: WaitForNavigationReadyOptions = {}
): Promise<boolean> {
  const isReady = options.isReady ?? (() => navigationRef.isReady());
  const now = options.now ?? (() => Date.now());
  const schedule = options.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms));
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 50;

  if (isReady()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const start = now();
    const tick = () => {
      if (isReady()) {
        resolve(true);
        return;
      }
      if (now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      schedule(tick, intervalMs);
    };
    schedule(tick, intervalMs);
  });
}
