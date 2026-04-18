const {
  generateInviteCode,
  validateGroupName,
  validateDisplayName,
  determineNewAdmin,
  computeStreak,
  computeMemberStats,
  INVITE_CODE_CHARS,
  INVITE_CODE_LENGTH,
  GROUP_NAME_MAX,
  DISPLAY_NAME_MAX,
} = require('../groupsLogic');

// ---------------------------------------------------------------------------
// generateInviteCode
// ---------------------------------------------------------------------------

describe('generateInviteCode', () => {
  it('returns an 8-character string', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
  });

  it('contains only allowed characters (no I/O/0/1)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(INVITE_CODE_CHARS).toContain(ch);
      }
      expect(code).not.toMatch(/[IO01]/);
    }
  });
});

// ---------------------------------------------------------------------------
// validateGroupName
// ---------------------------------------------------------------------------

describe('validateGroupName', () => {
  it('rejects empty string', () => {
    expect(validateGroupName('')).toEqual({ valid: false, error: expect.any(String) });
  });

  it('rejects whitespace-only', () => {
    expect(validateGroupName('   ')).toEqual({ valid: false, error: expect.any(String) });
  });

  it('rejects names exceeding max length', () => {
    const long = 'a'.repeat(GROUP_NAME_MAX + 1);
    expect(validateGroupName(long)).toEqual({ valid: false, error: expect.any(String) });
  });

  it('accepts a valid name', () => {
    expect(validateGroupName('Morning Crew')).toEqual({ valid: true });
  });

  it('accepts name at max length', () => {
    const exact = 'x'.repeat(GROUP_NAME_MAX);
    expect(validateGroupName(exact)).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// validateDisplayName
// ---------------------------------------------------------------------------

describe('validateDisplayName', () => {
  it('rejects empty string', () => {
    expect(validateDisplayName('')).toEqual({ valid: false, error: expect.any(String) });
  });

  it('rejects whitespace-only', () => {
    expect(validateDisplayName('  ')).toEqual({ valid: false, error: expect.any(String) });
  });

  it('rejects names exceeding max length', () => {
    const long = 'b'.repeat(DISPLAY_NAME_MAX + 1);
    expect(validateDisplayName(long)).toEqual({ valid: false, error: expect.any(String) });
  });

  it('accepts a valid name', () => {
    expect(validateDisplayName('Ben')).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// determineNewAdmin
// ---------------------------------------------------------------------------

describe('determineNewAdmin', () => {
  it('picks the member with the earliest joinedAtMs', () => {
    const members = {
      uid1: { joinedAtMs: 200 },
      uid2: { joinedAtMs: 100 },
      uid3: { joinedAtMs: 300 },
    };
    expect(determineNewAdmin(members, ['uid1', 'uid2', 'uid3'])).toBe('uid2');
  });

  it('returns the only remaining member', () => {
    const members = { uid1: { joinedAtMs: 500 } };
    expect(determineNewAdmin(members, ['uid1'])).toBe('uid1');
  });

  it('falls back to first UID if member data is missing', () => {
    expect(determineNewAdmin({}, ['uid1', 'uid2'])).toBe('uid1');
  });
});

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

describe('computeStreak', () => {
  const pastEnd = Date.now() - 1000; // safely in the past

  it('returns 0 when there are no standards', () => {
    expect(computeStreak([], [])).toBe(0);
  });

  it('counts consecutive met periods', () => {
    const standards = [{ id: 's1' }, { id: 's2' }];
    const history = [
      { standardId: 's1', status: 'Met', periodKey: 'p3', periodStartMs: 300, periodEndMs: pastEnd },
      { standardId: 's2', status: 'Met', periodKey: 'p3', periodStartMs: 300, periodEndMs: pastEnd },
      { standardId: 's1', status: 'Met', periodKey: 'p2', periodStartMs: 200, periodEndMs: pastEnd - 100 },
      { standardId: 's2', status: 'Met', periodKey: 'p2', periodStartMs: 200, periodEndMs: pastEnd - 100 },
      { standardId: 's1', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd - 200 },
      { standardId: 's2', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd - 200 },
    ];
    expect(computeStreak(history, standards)).toBe(3);
  });

  it('breaks streak when one standard is missed', () => {
    const standards = [{ id: 's1' }, { id: 's2' }];
    const history = [
      { standardId: 's1', status: 'Met', periodKey: 'p3', periodStartMs: 300, periodEndMs: pastEnd },
      { standardId: 's2', status: 'Met', periodKey: 'p3', periodStartMs: 300, periodEndMs: pastEnd },
      { standardId: 's1', status: 'Met', periodKey: 'p2', periodStartMs: 200, periodEndMs: pastEnd - 100 },
      { standardId: 's2', status: 'Missed', periodKey: 'p2', periodStartMs: 200, periodEndMs: pastEnd - 100 },
      { standardId: 's1', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd - 200 },
      { standardId: 's2', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd - 200 },
    ];
    expect(computeStreak(history, standards)).toBe(1);
  });

  it('skips in-progress periods (periodEndMs > now)', () => {
    const standards = [{ id: 's1' }];
    const futureEnd = Date.now() + 100000;
    const history = [
      { standardId: 's1', status: 'In Progress', periodKey: 'current', periodStartMs: 400, periodEndMs: futureEnd },
      { standardId: 's1', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd },
    ];
    expect(computeStreak(history, standards)).toBe(1);
  });

  it('filters out standards not in visibleStandards', () => {
    const standards = [{ id: 's1' }];
    const history = [
      { standardId: 's1', status: 'Met', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd },
      { standardId: 's_hidden', status: 'Missed', periodKey: 'p1', periodStartMs: 100, periodEndMs: pastEnd },
    ];
    expect(computeStreak(history, standards)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeMemberStats
// ---------------------------------------------------------------------------

describe('computeMemberStats', () => {
  it('returns zeros for empty standards', () => {
    expect(computeMemberStats([], [])).toEqual({
      metCount: 0,
      totalCount: 0,
      avgCompletion: 0,
    });
  });

  it('counts met standards from latest history entries', () => {
    const standards = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
    const history = [
      { standardId: 's1', status: 'Met', progressPercent: 100 },
      { standardId: 's2', status: 'Missed', progressPercent: 30 },
      { standardId: 's1', status: 'Missed', progressPercent: 50 }, // older, ignored
    ];
    expect(computeMemberStats(history, standards)).toEqual({
      metCount: 1,
      totalCount: 3,
      avgCompletion: Math.round((100 + 30) / 2),
    });
  });

  it('handles standards with no history', () => {
    const standards = [{ id: 's1' }, { id: 's2' }];
    const history = [
      { standardId: 's1', status: 'Met', progressPercent: 100 },
    ];
    const result = computeMemberStats(history, standards);
    expect(result.metCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.avgCompletion).toBe(100); // only s1 has history
  });
});
