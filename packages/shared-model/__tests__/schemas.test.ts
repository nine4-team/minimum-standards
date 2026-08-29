import { activityLogSchema, activitySchema, standardSchema } from '../src/schemas';
import { formatStandardSummary } from '../src/standard-summary';

describe('shared Zod schemas', () => {
  test('Activity happy path', () => {
    const parsed = activitySchema.parse({
      id: 'a1',
      name: 'Sales Calls',
      unit: 'calls',
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.name).toBe('Sales Calls');
    expect(parsed.unit).toBe('calls');
  });

  test('Activity normalizes singular unit to plural', () => {
    const parsed = activitySchema.parse({
      id: 'a1',
      name: 'Sales Calls',
      unit: 'call',
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.unit).toBe('calls');
  });

  test('Activity rejects empty name', () => {
    expect(() =>
      activitySchema.parse({
        id: 'a1',
        name: '',
        unit: 'calls',
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null
      })
    ).toThrow();
  });

  test('Standard happy path with new cadence structure', () => {
    const parsed = standardSchema.parse({
      id: 's1',
      activityId: 'a1',
      minimum: 100,
      unit: 'calls',
      cadence: { interval: 1, unit: 'week' },
      state: 'active',
      summary: '100 calls / week',
      sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 100 },
      archivedAtMs: null,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.minimum).toBe(100);
    expect(parsed.cadence.interval).toBe(1);
    expect(parsed.cadence.unit).toBe('week');
    expect(parsed.summary).toBe('100 calls / week');
    expect(parsed.archivedAtMs).toBeNull();
  });

  test('Standard with custom cadence interval', () => {
    const parsed = standardSchema.parse({
      id: 's1',
      activityId: 'a1',
      minimum: 50,
      unit: 'minutes',
      cadence: { interval: 2, unit: 'day' },
      state: 'active',
      summary: '50 minutes / 2 days',
      sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 50 },
      archivedAtMs: null,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.cadence.interval).toBe(2);
    expect(parsed.cadence.unit).toBe('day');
    expect(parsed.summary).toBe('50 minutes / 2 days');
  });

  test('Standard rejects invalid cadence structure', () => {
    expect(() =>
      standardSchema.parse({
        id: 's1',
        activityId: 'a1',
        minimum: 100,
        unit: 'calls',
        cadence: 'weekly', // Old format should fail
        state: 'active',
        summary: '100 calls / week',
        sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 100 },
        archivedAtMs: null,
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null
      })
    ).toThrow();
  });

  test('Standard rejects negative cadence interval', () => {
    expect(() =>
      standardSchema.parse({
        id: 's1',
        activityId: 'a1',
        minimum: 100,
        unit: 'calls',
        cadence: { interval: -1, unit: 'week' },
        state: 'active',
        summary: '100 calls / week',
        sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 100 },
        archivedAtMs: null,
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null
      })
    ).toThrow();
  });

  test('Standard with archived state and archivedAt timestamp', () => {
    const archivedAtMs = 1000;
    const parsed = standardSchema.parse({
      id: 's1',
      activityId: 'a1',
      minimum: 100,
      unit: 'calls',
      cadence: { interval: 1, unit: 'week' },
      state: 'archived',
      summary: '100 calls / week',
      sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 100 },
      archivedAtMs: archivedAtMs,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.state).toBe('archived');
    expect(parsed.archivedAtMs).toBe(archivedAtMs);
  });

  test('Standard rejects empty summary', () => {
    expect(() =>
      standardSchema.parse({
        id: 's1',
        activityId: 'a1',
        minimum: 100,
        unit: 'calls',
        cadence: { interval: 1, unit: 'week' },
        state: 'active',
        summary: '',
        sessionConfig: { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 100 },
        archivedAtMs: null,
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null
      })
    ).toThrow();
  });

  test('ActivityLog happy path', () => {
    const parsed = activityLogSchema.parse({
      id: 'l1',
      standardId: 's1',
      value: 14,
      occurredAtMs: 123,
      note: 'morning',
      editedAtMs: null,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null
    });

    expect(parsed.value).toBe(14);
  });

  test('ActivityLog rejects negative value', () => {
    expect(() =>
      activityLogSchema.parse({
        id: 'l1',
        standardId: 's1',
        value: -1,
        occurredAtMs: 123,
        note: null,
        editedAtMs: null,
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null
      })
    ).toThrow();
  });
});
