import { waitForNavigationReady } from '../navigationRef';

describe('waitForNavigationReady', () => {
  it('resolves immediately when already ready', async () => {
    const result = await waitForNavigationReady({
      isReady: () => true,
      now: () => 0,
      setTimeoutFn: () => {
        throw new Error('should not schedule when already ready');
      },
    });
    expect(result).toBe(true);
  });

  it('resolves true once readiness flips on a later tick', async () => {
    let ticks = 0;
    let nowMs = 0;
    const result = await waitForNavigationReady({
      timeoutMs: 1000,
      intervalMs: 10,
      isReady: () => ticks >= 3,
      now: () => nowMs,
      setTimeoutFn: (cb, ms) => {
        ticks += 1;
        nowMs += ms;
        // Fire synchronously to keep the test deterministic.
        cb();
        return 0;
      },
    });
    expect(result).toBe(true);
  });

  it('resolves false after the timeout elapses', async () => {
    let nowMs = 0;
    const result = await waitForNavigationReady({
      timeoutMs: 100,
      intervalMs: 25,
      isReady: () => false,
      now: () => nowMs,
      setTimeoutFn: (cb, ms) => {
        nowMs += ms;
        cb();
        return 0;
      },
    });
    expect(result).toBe(false);
  });
});
