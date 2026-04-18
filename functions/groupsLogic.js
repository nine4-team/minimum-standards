// Pure business logic for Accountability Groups.
// No Firestore, no Cloud Functions SDK — just data in, data out.

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const INVITE_CODE_LENGTH = 8;

const GROUP_NAME_MAX = 60;
const DISPLAY_NAME_MAX = 40;

/**
 * Generate a random invite code.
 * 8 uppercase alphanumeric characters, no ambiguous chars (I/O/0/1).
 */
function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Validate a group name.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateGroupName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { valid: false, error: 'Group name is required.' };
  if (trimmed.length > GROUP_NAME_MAX) return { valid: false, error: `Group name must be ${GROUP_NAME_MAX} characters or less.` };
  return { valid: true };
}

/**
 * Validate a display name.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDisplayName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { valid: false, error: 'Display name is required.' };
  if (trimmed.length > DISPLAY_NAME_MAX) return { valid: false, error: `Display name must be ${DISPLAY_NAME_MAX} characters or less.` };
  return { valid: true };
}

/**
 * Determine who should become admin when the current admin leaves.
 * Returns the UID of the member with the earliest joinedAtMs.
 *
 * @param {Record<string, { joinedAtMs: number }>} members - members map (excluding the leaving user)
 * @param {string[]} remainingUids - UIDs of remaining members
 * @returns {string} UID of the new admin
 */
function determineNewAdmin(members, remainingUids) {
  let oldestUid = remainingUids[0];
  let oldestJoinedAt = Infinity;
  for (const uid of remainingUids) {
    const member = members[uid];
    if (member && member.joinedAtMs < oldestJoinedAt) {
      oldestJoinedAt = member.joinedAtMs;
      oldestUid = uid;
    }
  }
  return oldestUid;
}

/**
 * Compute the consecutive-periods streak for a member.
 *
 * A period is "met" when every visible standard has status === 'Met'.
 * The current in-progress period (periodEndMs > now) is skipped.
 * Counts backward from the most recent completed period.
 *
 * @param {Array<{ periodKey?: string, periodStartMs?: number, periodEndMs?: number, standardId: string, status: string }>} visibleHistory
 * @param {Array<{ id: string }>} visibleStandards
 * @returns {number}
 */
function computeStreak(visibleHistory, visibleStandards) {
  if (visibleStandards.length === 0) return 0;

  // Group history by periodKey
  const periodMap = {};
  for (const h of visibleHistory) {
    if (!h.periodKey) continue;
    if (!periodMap[h.periodKey]) {
      periodMap[h.periodKey] = { entries: [], periodStartMs: h.periodStartMs || 0, periodEndMs: h.periodEndMs || 0 };
    }
    periodMap[h.periodKey].entries.push(h);
  }

  // Sort periods by periodStartMs descending
  const periods = Object.values(periodMap).sort((a, b) => b.periodStartMs - a.periodStartMs);

  // Skip current in-progress period
  const nowMs = Date.now();
  const completedPeriods = periods.filter((p) => p.periodEndMs <= nowMs);

  let streak = 0;
  const visibleIds = new Set(visibleStandards.map((s) => s.id));

  for (const period of completedPeriods) {
    const metInPeriod = new Set();
    for (const entry of period.entries) {
      if (visibleIds.has(entry.standardId) && entry.status === 'Met') {
        metInPeriod.add(entry.standardId);
      }
    }

    if (metInPeriod.size === visibleIds.size) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Compute member stats from history and standards.
 *
 * @param {Array<{ standardId: string, status: string, progressPercent?: number }>} visibleHistory - sorted desc by periodStartMs
 * @param {Array<{ id: string }>} visibleStandards
 * @returns {{ metCount: number, totalCount: number, avgCompletion: number }}
 */
function computeMemberStats(visibleHistory, visibleStandards) {
  // Build latest history entry per visible standard
  const latestByStandard = {};
  for (const h of visibleHistory) {
    if (!latestByStandard[h.standardId]) {
      latestByStandard[h.standardId] = h;
    }
  }

  const metCount = visibleStandards.filter((s) => {
    const latest = latestByStandard[s.id];
    return latest && latest.status === 'Met';
  }).length;

  let avgCompletion = 0;
  if (visibleStandards.length > 0) {
    let sum = 0;
    let count = 0;
    for (const s of visibleStandards) {
      const latest = latestByStandard[s.id];
      if (latest) {
        sum += latest.progressPercent || 0;
        count++;
      }
    }
    avgCompletion = count > 0 ? Math.round(sum / count) : 0;
  }

  return { metCount, totalCount: visibleStandards.length, avgCompletion };
}

module.exports = {
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
};
