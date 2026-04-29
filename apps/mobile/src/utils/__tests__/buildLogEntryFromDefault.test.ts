import { buildLogEntryFromDefault } from '../buildLogEntryFromDefault';

describe('buildLogEntryFromDefault', () => {
  const NOW = 1_700_000_000_000;

  it('returns a payload when defaultQuantity is a positive integer', () => {
    const result = buildLogEntryFromDefault(
      { id: 'std-1', defaultQuantity: 10 },
      NOW,
    );
    expect(result).toEqual({
      standardId: 'std-1',
      value: 10,
      occurredAtMs: NOW,
      note: null,
    });
  });

  it('returns a payload when defaultQuantity is a positive decimal', () => {
    const result = buildLogEntryFromDefault(
      { id: 'std-2', defaultQuantity: 0.5 },
      NOW,
    );
    expect(result).toEqual({
      standardId: 'std-2',
      value: 0.5,
      occurredAtMs: NOW,
      note: null,
    });
  });

  it('returns null when defaultQuantity is undefined', () => {
    expect(buildLogEntryFromDefault({ id: 'std-3' }, NOW)).toBeNull();
  });

  it('returns null when defaultQuantity is zero', () => {
    expect(
      buildLogEntryFromDefault({ id: 'std-4', defaultQuantity: 0 }, NOW),
    ).toBeNull();
  });

  it('returns null when defaultQuantity is negative', () => {
    expect(
      buildLogEntryFromDefault({ id: 'std-5', defaultQuantity: -3 }, NOW),
    ).toBeNull();
  });

  it('returns null when defaultQuantity is not finite', () => {
    expect(
      buildLogEntryFromDefault(
        { id: 'std-6', defaultQuantity: Number.NaN },
        NOW,
      ),
    ).toBeNull();
    expect(
      buildLogEntryFromDefault(
        { id: 'std-7', defaultQuantity: Number.POSITIVE_INFINITY },
        NOW,
      ),
    ).toBeNull();
  });
});
