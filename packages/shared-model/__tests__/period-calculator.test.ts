import {
  calculatePeriodWindow,
  derivePeriodStatus,
  PeriodWindow
} from '../src/period-calculator';

describe('period-calculator', () => {
  describe('calculatePeriodWindow - daily', () => {
    test('calculates daily period for a mid-day timestamp', () => {
      // December 11, 2025, 14:30:00 UTC
      const timestampMs = new Date('2025-12-11T14:30:00Z').getTime();
      const result = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'day' }, 'UTC');
      
      expect(result.startMs).toBe(new Date('2025-12-11T00:00:00Z').getTime());
      expect(result.endMs).toBe(new Date('2025-12-12T00:00:00Z').getTime());
      expect(result.periodKey).toBe('2025-12-11');
      expect(result.label).toBe('Dec 11');
    });

    test('daily boundary behavior at end-of-day transition', () => {
      // Just before midnight
      const justBeforeMidnight = new Date('2025-12-11T23:59:59Z').getTime();
      const beforeResult = calculatePeriodWindow(justBeforeMidnight, { interval: 1, unit: 'day' }, 'UTC');
      
      // Just after midnight (next day)
      const justAfterMidnight = new Date('2025-12-12T00:00:00Z').getTime();
      const afterResult = calculatePeriodWindow(justAfterMidnight, { interval: 1, unit: 'day' }, 'UTC');
      
      // Before midnight should be in Dec 11 period
      expect(beforeResult.periodKey).toBe('2025-12-11');
      expect(beforeResult.startMs).toBe(new Date('2025-12-11T00:00:00Z').getTime());
      expect(beforeResult.endMs).toBe(new Date('2025-12-12T00:00:00Z').getTime());
      
      // After midnight should be in Dec 12 period
      expect(afterResult.periodKey).toBe('2025-12-12');
      expect(afterResult.startMs).toBe(new Date('2025-12-12T00:00:00Z').getTime());
      expect(afterResult.endMs).toBe(new Date('2025-12-13T00:00:00Z').getTime());
      
      // End of Dec 11 should equal start of Dec 12 (exclusive boundary)
      expect(beforeResult.endMs).toBe(afterResult.startMs);
    });

    test('daily period in different timezone', () => {
      // December 11, 2025, 14:30:00 UTC = December 11, 2025, 09:30:00 EST
      const timestampMs = new Date('2025-12-11T14:30:00Z').getTime();
      const result = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'day' }, 'America/New_York');
      
      // In EST, this should still be December 11
      expect(result.periodKey).toBe('2025-12-11');
      expect(result.label).toBe('Dec 11');
    });
  });

  describe('calculatePeriodWindow - weekly', () => {
    test('calculates weekly period with Monday start', () => {
      // Wednesday, December 10, 2025 (assuming it's in a week starting Monday Dec 8)
      const timestampMs = new Date('2025-12-10T14:30:00Z').getTime();
      const result = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'week' }, 'UTC');
      
      // Should start on Monday of that week
      const monday = new Date('2025-12-08T00:00:00Z').getTime();
      const nextMonday = new Date('2025-12-15T00:00:00Z').getTime();
      
      expect(result.startMs).toBe(monday);
      expect(result.endMs).toBe(nextMonday);
      expect(result.label).toBe('Dec 8 - Dec 14'); // End is exclusive, so show day before
    });

    test('weekly boundary behavior - Sunday to Monday transition', () => {
      // Sunday, December 7, 2025, 23:59:59 UTC
      const sundayLate = new Date('2025-12-07T23:59:59Z').getTime();
      const sundayResult = calculatePeriodWindow(sundayLate, { interval: 1, unit: 'week' }, 'UTC');
      
      // Monday, December 8, 2025, 00:00:00 UTC
      const mondayEarly = new Date('2025-12-08T00:00:00Z').getTime();
      const mondayResult = calculatePeriodWindow(mondayEarly, { interval: 1, unit: 'week' }, 'UTC');
      
      // Sunday should be in the previous week (Nov 30 - Dec 7)
      // Monday should start a new week (Dec 8 - Dec 14)
      expect(sundayResult.periodKey).not.toBe(mondayResult.periodKey);
      expect(sundayResult.endMs).toBe(mondayResult.startMs); // Exclusive boundary
    });

    test('weekly period uses Monday as start day', () => {
      // Monday, December 8, 2025
      const monday = new Date('2025-12-08T12:00:00Z').getTime();
      const mondayResult = calculatePeriodWindow(monday, { interval: 1, unit: 'week' }, 'UTC');
      
      // Tuesday, December 9, 2025 (same week)
      const tuesday = new Date('2025-12-09T12:00:00Z').getTime();
      const tuesdayResult = calculatePeriodWindow(tuesday, { interval: 1, unit: 'week' }, 'UTC');
      
      // Both should be in the same period
      expect(mondayResult.periodKey).toBe(tuesdayResult.periodKey);
      expect(mondayResult.startMs).toBe(tuesdayResult.startMs);
      expect(mondayResult.endMs).toBe(tuesdayResult.endMs);
    });
  });

  describe('calculatePeriodWindow - monthly', () => {
    test('calculates monthly period', () => {
      // December 15, 2025
      const timestampMs = new Date('2025-12-15T14:30:00Z').getTime();
      const result = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'month' }, 'UTC');
      
      expect(result.startMs).toBe(new Date('2025-12-01T00:00:00Z').getTime());
      expect(result.endMs).toBe(new Date('2026-01-01T00:00:00Z').getTime());
      expect(result.periodKey).toBe('2025-12');
      expect(result.label).toBe('Dec');
    });

    test('monthly boundary behavior - end of month to start of next', () => {
      // December 31, 2025, 23:59:59 UTC
      const endOfMonth = new Date('2025-12-31T23:59:59Z').getTime();
      const decemberResult = calculatePeriodWindow(endOfMonth, { interval: 1, unit: 'month' }, 'UTC');
      
      // January 1, 2026, 00:00:00 UTC
      const startOfNextMonth = new Date('2026-01-01T00:00:00Z').getTime();
      const januaryResult = calculatePeriodWindow(startOfNextMonth, { interval: 1, unit: 'month' }, 'UTC');
      
      expect(decemberResult.periodKey).toBe('2025-12');
      expect(januaryResult.periodKey).toBe('2026-01');
      expect(decemberResult.endMs).toBe(januaryResult.startMs); // Exclusive boundary
    });

    test('monthly period handles year boundary', () => {
      // December 31, 2025
      const dec31 = new Date('2025-12-31T12:00:00Z').getTime();
      const decResult = calculatePeriodWindow(dec31, { interval: 1, unit: 'month' }, 'UTC');
      
      // January 1, 2026
      const jan1 = new Date('2026-01-01T12:00:00Z').getTime();
      const janResult = calculatePeriodWindow(jan1, { interval: 1, unit: 'month' }, 'UTC');
      
      expect(decResult.periodKey).toBe('2025-12');
      expect(janResult.periodKey).toBe('2026-01');
    });
  });

  describe('calculatePeriodWindow - DST transition', () => {
    test('handles DST transition day correctly', () => {
      // March 9, 2025 - DST starts in US (2 AM becomes 3 AM)
      // Using a timezone that observes DST
      const beforeDST = new Date('2025-03-09T06:59:59Z').getTime(); // 1:59 AM EST
      const afterDST = new Date('2025-03-09T07:00:01Z').getTime(); // 3:00 AM EDT
      
      const beforeResult = calculatePeriodWindow(beforeDST, { interval: 1, unit: 'day' }, 'America/New_York');
      const afterResult = calculatePeriodWindow(afterDST, { interval: 1, unit: 'day' }, 'America/New_York');
      
      // Both should still be in the same day period (March 9)
      expect(beforeResult.periodKey).toBe(afterResult.periodKey);
      expect(beforeResult.periodKey).toBe('2025-03-09');
    });

    test('weekly period across DST transition', () => {
      // Week containing DST transition
      const duringDST = new Date('2025-03-12T14:30:00Z').getTime(); // Wednesday during DST week
      const result = calculatePeriodWindow(duringDST, { interval: 1, unit: 'week' }, 'America/New_York');
      
      // Should still calculate a valid 7-day period
      const periodDuration = result.endMs - result.startMs;
      // Should be approximately 7 days (allowing for DST adjustments)
      expect(periodDuration).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(periodDuration).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    });
  });

  describe('calculatePeriodWindow - timezone change scenario', () => {
    test('same timestamp evaluated in different timezones produces different periods when crossing boundaries', () => {
      // A timestamp that represents different local dates in different timezones
      // December 11, 2025, 02:00:00 UTC
      // In UTC: December 11
      // In America/Los_Angeles (UTC-8): December 10 (6 PM Dec 10)
      const timestampMs = new Date('2025-12-11T02:00:00Z').getTime();
      
      const utcResult = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'day' }, 'UTC');
      const laResult = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'day' }, 'America/Los_Angeles');
      
      // In UTC, it's December 11
      expect(utcResult.periodKey).toBe('2025-12-11');
      
      // In LA, it's December 10 (because 02:00 UTC = 18:00 PST previous day)
      expect(laResult.periodKey).toBe('2025-12-10');
    });

    test('timezone change affects weekly period assignment', () => {
      // A timestamp near a week boundary
      // Monday, December 8, 2025, 01:00:00 UTC
      // In UTC: Monday (new week)
      // In Pacific: Sunday (previous week, because 01:00 UTC = 17:00 PST previous day)
      const timestampMs = new Date('2025-12-08T01:00:00Z').getTime();
      
      const utcResult = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'week' }, 'UTC');
      const pacificResult = calculatePeriodWindow(timestampMs, { interval: 1, unit: 'week' }, 'America/Los_Angeles');
      
      // Should potentially be in different weeks
      // This depends on the exact timing, but demonstrates timezone sensitivity
      expect(utcResult.startMs).not.toBe(pacificResult.startMs);
    });
  });

  describe('calculatePeriodWindow - period start preferences', () => {
    test('weekly cadence respects custom weekday start', () => {
      const referenceDate = new Date('2025-12-10T14:30:00Z').getTime(); // Wednesday
      const window = calculatePeriodWindow(
        referenceDate,
        { interval: 1, unit: 'week' },
        'UTC',
        { periodStartPreference: { mode: 'weekDay', weekStartDay: 3 } }
      );

      expect(window.startMs).toBe(new Date('2025-12-10T00:00:00Z').getTime());
      expect(window.endMs).toBe(new Date('2025-12-17T00:00:00Z').getTime());
      expect(window.periodKey).toBe('2025-12-10');
      expect(window.label).toBe('Dec 10 - Dec 16');
    });

  });

  describe('derivePeriodStatus', () => {
    test('returns Met when total >= minimum', () => {
      const status = derivePeriodStatus(100, 50, Date.now(), Date.now() + 1000);
      expect(status).toBe('Met');
    });

    test('returns Met when total equals minimum', () => {
      const status = derivePeriodStatus(50, 50, Date.now(), Date.now() + 1000);
      expect(status).toBe('Met');
    });

    test('returns In Progress when period is open and total < minimum', () => {
      const now = Date.now();
      const periodEnd = now + 24 * 60 * 60 * 1000; // 1 day in future
      const status = derivePeriodStatus(30, 50, now, periodEnd);
      expect(status).toBe('In Progress');
    });

    test('returns Missed when period ended and total < minimum', () => {
      const now = Date.now();
      const periodEnd = now - 1000; // Period ended 1 second ago
      const status = derivePeriodStatus(30, 50, now, periodEnd);
      expect(status).toBe('Missed');
    });

    test('returns In Progress when now equals period start (boundary case)', () => {
      const now = Date.now();
      const periodStart = now;
      const periodEnd = now + 24 * 60 * 60 * 1000;
      const status = derivePeriodStatus(30, 50, periodStart, periodEnd);
      expect(status).toBe('In Progress');
    });

    test('returns Missed when now equals period end (boundary case - exclusive)', () => {
      const now = Date.now();
      const periodEnd = now; // Period end is exclusive, so this means period has ended
      const status = derivePeriodStatus(30, 50, now, periodEnd);
      expect(status).toBe('Missed');
    });

    test('status derivation uses period end boundary correctly', () => {
      const periodStart = new Date('2025-12-11T00:00:00Z').getTime();
      const periodEnd = new Date('2025-12-12T00:00:00Z').getTime();
      
      // Just before period ends
      const justBefore = periodEnd - 1;
      const statusBefore = derivePeriodStatus(30, 50, justBefore, periodEnd);
      expect(statusBefore).toBe('In Progress');
      
      // At period end (exclusive, so period has ended)
      const atEnd = periodEnd;
      const statusAtEnd = derivePeriodStatus(30, 50, atEnd, periodEnd);
      expect(statusAtEnd).toBe('Missed');
    });
  });
});
