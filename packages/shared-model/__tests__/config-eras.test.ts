import { resolveEraForTimestamp, buildSnapshotFromEra, buildSnapshotFromStandard } from '../src/config-eras';
import { Standard, ConfigEra } from '../src/types';

const BASE_CADENCE = { interval: 1, unit: 'week' as const };
const BASE_SESSION_CONFIG = { sessionLabel: 'session', sessionsPerCadence: 1, volumePerSession: 10 };

function makeStandard(overrides: Partial<Standard> = {}): Standard {
  return {
    id: 'std1',
    activityId: 'act1',
    minimum: 10,
    unit: 'minutes',
    cadence: BASE_CADENCE,
    state: 'active',
    summary: '10 minutes / week',
    archivedAtMs: null,
    sessionConfig: BASE_SESSION_CONFIG,
    categoryId: null,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    deletedAtMs: null,
    ...overrides,
  };
}

function makeEra(effectiveFromMs: number, minimum: number): ConfigEra {
  return {
    effectiveFromMs,
    minimum,
    unit: 'minutes',
    cadence: BASE_CADENCE,
    sessionConfig: BASE_SESSION_CONFIG,
    summary: `${minimum} minutes / week`,
  };
}

describe('resolveEraForTimestamp', () => {
  test('returns null when standard has no configEras', () => {
    const standard = makeStandard({ configEras: undefined });
    expect(resolveEraForTimestamp(standard, 5000)).toBeNull();
  });

  test('returns null when configEras is empty array', () => {
    const standard = makeStandard({ configEras: [] });
    expect(resolveEraForTimestamp(standard, 5000)).toBeNull();
  });

  test('single era covers all timestamps', () => {
    const era = makeEra(1000, 10);
    const standard = makeStandard({ configEras: [era] });

    expect(resolveEraForTimestamp(standard, 500)).toBe(era);   // before era
    expect(resolveEraForTimestamp(standard, 1000)).toBe(era);  // on boundary
    expect(resolveEraForTimestamp(standard, 9999)).toBe(era);  // well after
  });

  test('multiple eras — resolves to correct era by timestamp', () => {
    const era1 = makeEra(1000, 10);
    const era2 = makeEra(5000, 20);
    const era3 = makeEra(9000, 30);
    const standard = makeStandard({ configEras: [era1, era2, era3] });

    expect(resolveEraForTimestamp(standard, 999)).toBe(era1);   // before first era
    expect(resolveEraForTimestamp(standard, 1000)).toBe(era1);  // on first boundary
    expect(resolveEraForTimestamp(standard, 4999)).toBe(era1);  // just before second
    expect(resolveEraForTimestamp(standard, 5000)).toBe(era2);  // on second boundary
    expect(resolveEraForTimestamp(standard, 7000)).toBe(era2);  // between second and third
    expect(resolveEraForTimestamp(standard, 9000)).toBe(era3);  // on third boundary
    expect(resolveEraForTimestamp(standard, 99999)).toBe(era3); // well after last
  });

  test('timestamp on era boundary resolves to the new era', () => {
    const era1 = makeEra(1000, 10);
    const era2 = makeEra(5000, 20);
    const standard = makeStandard({ configEras: [era1, era2] });

    expect(resolveEraForTimestamp(standard, 5000)).toBe(era2);
  });

  test('timestamp before first era returns first era', () => {
    const era = makeEra(5000, 10);
    const standard = makeStandard({ configEras: [era] });

    expect(resolveEraForTimestamp(standard, 0)).toBe(era);
    expect(resolveEraForTimestamp(standard, 4999)).toBe(era);
  });

  test('handles unsorted eras (sorts internally)', () => {
    const era1 = makeEra(1000, 10);
    const era2 = makeEra(5000, 20);
    // Provide in reverse order
    const standard = makeStandard({ configEras: [era2, era1] });

    expect(resolveEraForTimestamp(standard, 3000)).toBe(era1);
    expect(resolveEraForTimestamp(standard, 7000)).toBe(era2);
  });
});

describe('buildSnapshotFromEra', () => {
  test('converts era fields to snapshot', () => {
    const era: ConfigEra = {
      effectiveFromMs: 1000,
      minimum: 15,
      unit: 'km',
      cadence: { interval: 1, unit: 'week' },
      sessionConfig: { sessionLabel: 'run', sessionsPerCadence: 3, volumePerSession: 5 },
      summary: '15 km / week',
    };

    const snapshot = buildSnapshotFromEra(era);

    expect(snapshot.minimum).toBe(15);
    expect(snapshot.unit).toBe('km');
    expect(snapshot.cadence).toEqual({ interval: 1, unit: 'week' });
    expect(snapshot.sessionConfig).toEqual(era.sessionConfig);
    expect(snapshot.summary).toBe('15 km / week');
    expect(snapshot.periodStartPreference).toBeUndefined();
  });

  test('includes periodStartPreference when present', () => {
    const era: ConfigEra = {
      effectiveFromMs: 1000,
      minimum: 10,
      unit: 'minutes',
      cadence: BASE_CADENCE,
      sessionConfig: BASE_SESSION_CONFIG,
      summary: '10 minutes / week',
      periodStartPreference: { mode: 'weekDay', weekStartDay: 1 },
    };

    const snapshot = buildSnapshotFromEra(era);
    expect(snapshot.periodStartPreference).toEqual({ mode: 'weekDay', weekStartDay: 1 });
  });
});

describe('buildSnapshotFromStandard', () => {
  test('converts standard fields to snapshot', () => {
    const standard = makeStandard({ minimum: 20, unit: 'km', summary: '20 km / week' });
    const snapshot = buildSnapshotFromStandard(standard);

    expect(snapshot.minimum).toBe(20);
    expect(snapshot.unit).toBe('km');
    expect(snapshot.cadence).toEqual(BASE_CADENCE);
    expect(snapshot.sessionConfig).toEqual(BASE_SESSION_CONFIG);
    expect(snapshot.summary).toBe('20 km / week');
    expect(snapshot.periodStartPreference).toBeUndefined();
  });

  test('includes periodStartPreference when present', () => {
    const standard = makeStandard({
      periodStartPreference: { mode: 'weekDay', weekStartDay: 3 },
    });

    const snapshot = buildSnapshotFromStandard(standard);
    expect(snapshot.periodStartPreference).toEqual({ mode: 'weekDay', weekStartDay: 3 });
  });
});
