import {
  FirestoreStandardData,
  toFirestoreStandardArchiveState,
} from '../standardConverter';

const timestamp = (ms: number) => ({ toMillis: () => ms }) as never;

describe('standardConverter', () => {
  test('builds a rules-valid archive payload from legacy standard data', () => {
    const serverTimestamp = { _methodName: 'serverTimestamp' } as never;
    const data = {
      name: 'Cold Calls',
      minimum: 2500,
      unit: 'calls',
      cadence: { interval: 1, unit: 'week' },
      state: 'active',
      summary: '2500 calls / week',
      sessionConfig: {
        sessionLabel: 'session',
        sessionsPerCadence: 1,
        volumePerSession: 2500,
      },
      archivedAt: null,
      createdAt: timestamp(1000),
      updatedAt: timestamp(2000),
      deletedAt: null,
      dashboardPageId: 'page-1',
      dashboardOrderIndex: 2,
      legacyField: 'remove me',
    } as FirestoreStandardData & { legacyField: string };

    const payload = toFirestoreStandardArchiveState(data, true, serverTimestamp);

    expect(payload).toEqual({
      name: 'Cold Calls',
      minimum: 2500,
      unit: 'calls',
      cadence: { interval: 1, unit: 'week' },
      state: 'archived',
      summary: '2500 calls / week',
      sessionConfig: {
        sessionLabel: 'session',
        sessionsPerCadence: 1,
        volumePerSession: 2500,
      },
      archivedAt: serverTimestamp,
      createdAt: data.createdAt,
      updatedAt: serverTimestamp,
      deletedAt: null,
      dashboardPageId: 'page-1',
      dashboardOrderIndex: 2,
    });
  });
});
