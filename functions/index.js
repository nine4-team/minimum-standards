const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');

admin.initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

/**
 * Compute the current period window for a standard based on its cadence and timezone.
 * Mirrors the shared-model calculatePeriodWindow logic without luxon.
 * Uses Intl.DateTimeFormat to resolve local dates in the given timezone.
 */
function computePeriodWindow(nowMs, cadence, periodStartPreference, timezone) {
  // Get the local date parts in the user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(nowMs)).map((p) => [p.type, p.value])
  );
  const year = parseInt(parts.year);
  const month = parseInt(parts.month) - 1; // 0-indexed
  const day = parseInt(parts.day);

  // Create a Date that represents midnight in the user's timezone
  // by computing the offset between UTC and the timezone
  function midnightInTz(y, m, d) {
    // Create a UTC date, then adjust for timezone offset
    const utcGuess = new Date(Date.UTC(y, m, d, 12, 0, 0)); // noon UTC as starting point
    const tzParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(utcGuess)
        .map((p) => [p.type, p.value])
    );
    const tzHour = parseInt(tzParts.hour);
    const tzMinute = parseInt(tzParts.minute);
    const tzDay = parseInt(tzParts.day);
    const tzMonth = parseInt(tzParts.month) - 1;
    const tzYear = parseInt(tzParts.year);

    // Offset = local time - UTC time (in ms)
    const localMs = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute)).getTime();
    const utcMs = utcGuess.getTime();
    const offsetMs = localMs - utcMs;

    // Midnight in timezone = midnight UTC minus offset
    return new Date(Date.UTC(y, m, d) - offsetMs).getTime();
  }

  if (cadence.unit === 'day') {
    const startMs = midnightInTz(year, month, day);
    const endMs = midnightInTz(year, month, day + cadence.interval);
    return { startMs, endMs };
  }

  if (cadence.unit === 'week') {
    let weekStartDay = 1; // Monday (luxon convention: 1=Mon..7=Sun)
    if (
      periodStartPreference &&
      periodStartPreference.mode === 'weekDay' &&
      periodStartPreference.weekStartDay
    ) {
      weekStartDay = periodStartPreference.weekStartDay;
    }
    // Map JS getDay (0=Sun..6=Sat) to luxon weekday (1=Mon..7=Sun)
    const dayNameToLuxon = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentWeekday = dayNameToLuxon[parts.weekday] || 1;
    const daysBack = (currentWeekday - weekStartDay + 7) % 7;
    const startDay = day - daysBack;
    const startMs = midnightInTz(year, month, startDay);
    const endMs = midnightInTz(year, month, startDay + 7 * cadence.interval);
    return { startMs, endMs };
  }

  if (cadence.unit === 'month') {
    const startMs = midnightInTz(year, month, 1);
    const endMs = midnightInTz(year, month + cadence.interval, 1);
    return { startMs, endMs };
  }

  throw new Error(`Unsupported cadence unit: ${cadence.unit}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getShareCodeFromRequest(req) {
  const queryCode = req.query.shareCode || req.query.code || req.query.snapshotCode;
  if (queryCode) {
    return String(queryCode).trim().toUpperCase();
  }

  const parts = String(req.path || '')
    .split('/')
    .filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Group Join Page — serves OG-tagged HTML with deep link for group invites
// ---------------------------------------------------------------------------

exports.groupJoinPage = functions.https.onRequest(async (req, res) => {
  try {
    const parts = String(req.path || '')
      .split('/')
      .filter(Boolean);
    const inviteCode = (parts[parts.length - 1] || '').trim().toUpperCase();
    const origin = `${req.protocol}://${req.get('host')}`;
    const deepLink = `minimumstandards://group/join/${encodeURIComponent(inviteCode)}`;
    const logoUrl = `${origin}/logo.png`;

    let groupName = '';
    let valid = false;

    if (inviteCode) {
      const snap = await admin
        .firestore()
        .collection('accountabilityGroups')
        .where('inviteCode', '==', inviteCode)
        .limit(1)
        .get();

      if (!snap.empty) {
        const group = snap.docs[0].data();
        groupName = group.name || 'Accountability Group';
        valid = true;
      }
    }

    const title = valid
      ? `Join ${groupName} — Minimum Standards`
      : 'Invalid Invite — Minimum Standards';
    const description = valid
      ? `Join ${groupName} on Minimum Standards!`
      : 'This invite link is invalid or has expired.';

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>

    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(logoUrl)}" />
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(logoUrl)}" />
  </head>
  <body style="font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial; padding: 24px;">
    <h1 style="margin: 0 0 8px 0;">${escapeHtml(valid ? groupName : 'Invalid Invite')}</h1>
    <p style="margin: 0 0 16px 0; color: #444;">${escapeHtml(description)}</p>
    ${valid ? `
    <a href="${escapeHtml(deepLink)}"
       style="display:inline-block; padding: 12px 16px; background: #0B5FFF; color: white; border-radius: 10px; text-decoration: none; font-weight: 600;">
      Open in Minimum Standards
    </a>

    <script>
      setTimeout(function () {
        window.location.href = ${JSON.stringify(deepLink)};
      }, 250);
    </script>` : ''}
  </body>
</html>`);
  } catch (err) {
    res.status(500).send('Failed to render group invite page.');
  }
});

// ---------------------------------------------------------------------------
// Share Page — serves OG-tagged HTML with deep link for snapshot sharing
// ---------------------------------------------------------------------------

exports.sharePage = functions.https.onRequest(async (req, res) => {
  try {
    const shareCode = getShareCodeFromRequest(req);
    const origin = `${req.protocol}://${req.get('host')}`;
    const deepLink = `minimumstandards://snapshot/${encodeURIComponent(shareCode)}`;
    const logoUrl = `${origin}/logo.png`;

    let snapshotTitle = 'Snapshot';
    let shareEnabled = true;

    if (shareCode) {
      const shareLinks = await admin
        .firestore()
        .collection('shareLinks')
        .where('shareCode', '==', shareCode)
        .limit(1)
        .get();

      if (!shareLinks.empty) {
        const shareLinkDoc = shareLinks.docs[0];
        const shareLink = shareLinkDoc.data() || {};
        if (shareLink.disabledAt) {
          shareEnabled = false;
        }
        const snapshotId = shareLink.snapshotId;
        if (snapshotId) {
          const snapshotDoc = await admin.firestore().collection('snapshots').doc(snapshotId).get();
          const snapshot = snapshotDoc.exists ? snapshotDoc.data() : null;
          if (snapshot && snapshot.title) {
            snapshotTitle = String(snapshot.title);
          }
          if (snapshot && snapshot.isEnabled === false) {
            shareEnabled = false;
          }
        }
      } else {
        shareEnabled = false;
      }
    } else {
      shareEnabled = false;
    }

    const title = `${snapshotTitle} — Minimum Standards`;
    const description = shareEnabled
      ? `Import the "${snapshotTitle}" snapshot in Minimum Standards.`
      : `This snapshot link is disabled or invalid.`;

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>

    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(logoUrl)}" />
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(logoUrl)}" />
  </head>
  <body style="font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial; padding: 24px;">
    <h1 style="margin: 0 0 8px 0;">${escapeHtml(snapshotTitle)}</h1>
    <p style="margin: 0 0 16px 0; color: #444;">${escapeHtml(description)}</p>

    <a href="${escapeHtml(deepLink)}"
       style="display:inline-block; padding: 12px 16px; background: #0B5FFF; color: white; border-radius: 10px; text-decoration: none; font-weight: 600;">
      Open in Minimum Standards
    </a>

    <script>
      // For humans: try to open the app. Keep the HTML response so preview bots can read OG tags.
      setTimeout(function () {
        window.location.href = ${JSON.stringify(deepLink)};
      }, 250);
    </script>
  </body>
</html>`);
  } catch (err) {
    res.status(500).send('Failed to render share preview.');
  }
});

// --- suggestStandards ---

const SUGGEST_SYSTEM_PROMPT = `You help people create recurring minimum commitments ("standards") for self-improvement.
A standard has an activity name (e.g. "Running") and a unit of measurement (e.g. "minutes", "miles").

Given what the user wants to improve, suggest 4-5 specific, measurable activities.
For each activity, suggest 3-4 concrete units of measurement.
Prefer specific over vague. Units should be countable.

Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "suggestions": [
    { "name": "Activity Name", "units": ["unit1", "unit2", "unit3"] }
  ]
}`;

const DAILY_SUGGEST_LIMIT = 20;

async function checkRateLimit(uid) {
  const ref = admin.firestore().doc(`users/${uid}/rateLimits/suggestStandards`);
  const doc = await ref.get();
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  if (doc.exists) {
    const data = doc.data();
    if (data.windowStartMs >= todayMs) {
      if (data.count >= DAILY_SUGGEST_LIMIT) {
        return false;
      }
      await ref.update({ count: admin.firestore.FieldValue.increment(1) });
      return true;
    }
  }
  await ref.set({ count: 1, windowStartMs: todayMs });
  return true;
}

exports.suggestStandards = functions.https.onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userInput = (request.data && request.data.userInput) || '';
    const trimmed = String(userInput).trim();
    if (!trimmed || trimmed.length > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Please enter a description (max 500 characters).'
      );
    }

    const allowed = await checkRateLimit(request.auth.uid);
    if (!allowed) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Daily suggestion limit reached. Try again tomorrow.'
      );
    }

    try {
      const client = new Anthropic({ apiKey: anthropicApiKey.value() });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.7,
        system: SUGGEST_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
      });

      const text = message.content[0].text;
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        throw new Error('Empty suggestions');
      }

      return { suggestions: parsed.suggestions };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('suggestStandards error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Something went wrong. Please try again.'
      );
    }
  }
);

// ---------------------------------------------------------------------------
// Accountability Groups — Group Management
// ---------------------------------------------------------------------------

const {
  generateInviteCode,
  validateGroupName,
  validateDisplayName,
  determineNewAdmin,
  computeMemberStats,
} = require('./groupsLogic');

const DEFAULT_MEMBER_CAP = 10;

exports.createGroup = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const name = (request.data && request.data.name) || '';
  const displayName = (request.data && request.data.displayName) || '';
  const trimmedName = String(name).trim();
  const trimmedDisplayName = String(displayName).trim();

  const nameCheck = validateGroupName(trimmedName);
  if (!nameCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', nameCheck.error);
  }
  const dnCheck = validateDisplayName(trimmedDisplayName);
  if (!dnCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', dnCheck.error);
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const nowMs = Date.now();

  // Write display name if not already set
  await db.doc(`users/${uid}`).set({ displayName: trimmedDisplayName }, { merge: true });

  // Generate a unique invite code
  let inviteCode;
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateInviteCode();
    const existing = await db
      .collection('accountabilityGroups')
      .where('inviteCode', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) {
      inviteCode = candidate;
      break;
    }
    attempts++;
  }
  if (!inviteCode) {
    throw new functions.https.HttpsError('internal', 'Failed to generate invite code.');
  }

  const groupRef = db.collection('accountabilityGroups').doc();
  await groupRef.set({
    name: trimmedName,
    createdByUid: uid,
    memberCap: DEFAULT_MEMBER_CAP,
    members: {
      [uid]: { displayName: trimmedDisplayName, joinedAtMs: nowMs },
    },
    memberUids: [uid],
    inviteCode,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  });

  return { groupId: groupRef.id, inviteCode };
});

exports.joinGroup = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const inviteCode = String((request.data && request.data.inviteCode) || '').trim().toUpperCase();
  const displayName = String((request.data && request.data.displayName) || '').trim();

  if (!inviteCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Invite code is required.');
  }
  const dnCheck = validateDisplayName(displayName);
  if (!dnCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', dnCheck.error);
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const snap = await db
    .collection('accountabilityGroups')
    .where('inviteCode', '==', inviteCode)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new functions.https.HttpsError('not-found', 'Invalid invite code.');
  }

  const groupDoc = snap.docs[0];
  const group = groupDoc.data();

  if (group.memberUids.includes(uid)) {
    throw new functions.https.HttpsError('already-exists', 'You are already a member of this group.');
  }

  if (group.memberUids.length >= (group.memberCap || DEFAULT_MEMBER_CAP)) {
    throw new functions.https.HttpsError('resource-exhausted', 'This group is full.');
  }

  const nowMs = Date.now();
  await db.doc(`users/${uid}`).set({ displayName }, { merge: true });

  await groupDoc.ref.update({
    [`members.${uid}`]: { displayName, joinedAtMs: nowMs },
    memberUids: admin.firestore.FieldValue.arrayUnion(uid),
    updatedAtMs: nowMs,
  });

  return { groupId: groupDoc.id };
});

exports.leaveGroup = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  if (!groupId) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId is required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const groupRef = db.doc(`accountabilityGroups/${groupId}`);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (!group.memberUids.includes(uid)) {
    throw new functions.https.HttpsError('failed-precondition', 'You are not a member of this group.');
  }

  const remainingUids = group.memberUids.filter((id) => id !== uid);

  if (remainingUids.length === 0) {
    // Last member — delete the group
    await groupRef.delete();
    return { deleted: true };
  }

  const updates = {
    [`members.${uid}`]: admin.firestore.FieldValue.delete(),
    memberUids: remainingUids,
    updatedAtMs: Date.now(),
  };

  // If admin is leaving, transfer to oldest remaining member
  if (group.createdByUid === uid) {
    updates.createdByUid = determineNewAdmin(group.members, remainingUids);
  }

  await groupRef.update(updates);
  return { deleted: false };
});

exports.transferAdmin = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  const newAdminUid = (request.data && request.data.newAdminUid) || '';

  if (!groupId || !newAdminUid) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId and newAdminUid are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const groupRef = db.doc(`accountabilityGroups/${groupId}`);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (group.createdByUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the admin can transfer admin role.');
  }
  if (!group.memberUids.includes(newAdminUid)) {
    throw new functions.https.HttpsError('failed-precondition', 'Target user is not a member.');
  }

  await groupRef.update({ createdByUid: newAdminUid, updatedAtMs: Date.now() });
  return { success: true };
});

exports.removeMember = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  const targetUid = (request.data && request.data.targetUid) || '';

  if (!groupId || !targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId and targetUid are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const groupRef = db.doc(`accountabilityGroups/${groupId}`);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (group.createdByUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the admin can remove members.');
  }
  if (targetUid === uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Use leaveGroup to leave as admin.');
  }
  if (!group.memberUids.includes(targetUid)) {
    throw new functions.https.HttpsError('failed-precondition', 'Target is not a member.');
  }

  await groupRef.update({
    [`members.${targetUid}`]: admin.firestore.FieldValue.delete(),
    memberUids: group.memberUids.filter((id) => id !== targetUid),
    updatedAtMs: Date.now(),
  });

  return { success: true };
});

exports.updateDisplayName = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const displayName = String((request.data && request.data.displayName) || '').trim();
  const dnCheck = validateDisplayName(displayName);
  if (!dnCheck.valid) {
    throw new functions.https.HttpsError('invalid-argument', dnCheck.error);
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Update user doc
  await db.doc(`users/${uid}`).set({ displayName }, { merge: true });

  // Fan out to all groups the user belongs to
  const groups = await db
    .collection('accountabilityGroups')
    .where('memberUids', 'array-contains', uid)
    .get();

  const batch = db.batch();
  groups.forEach((groupDoc) => {
    batch.update(groupDoc.ref, {
      [`members.${uid}.displayName`]: displayName,
      updatedAtMs: Date.now(),
    });
  });
  await batch.commit();

  return { success: true };
});

// ---------------------------------------------------------------------------
// Accountability Groups — Data Access
// ---------------------------------------------------------------------------

exports.getMemberDashboard = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  const timezone = (request.data && request.data.timezone) || 'UTC';
  if (!groupId) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId is required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const groupSnap = await db.doc(`accountabilityGroups/${groupId}`).get();

  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (!group.memberUids.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'You are not a member of this group.');
  }

  const memberResults = [];

  for (const memberUid of group.memberUids) {
    const memberInfo = group.members[memberUid] || {};

    // Fetch all standards then filter in code — Firestore where('field', '==', null)
    // doesn't match docs where the field is missing entirely.
    const standardsSnap = await db
      .collection(`users/${memberUid}/standards`)
      .get();

    const allStandards = [];
    const visibleStandards = [];
    standardsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.state !== 'active') return;
      if (data.deletedAt) return;
      allStandards.push({ id: doc.id, ...data });
      if (!data.hiddenFromGroup) {
        visibleStandards.push({ id: doc.id, ...data });
      }
    });

    // Compute current period progress from activityLogs
    const nowMs = Date.now();
    const standardWindows = visibleStandards.map((s) => {
      const window = computePeriodWindow(nowMs, s.cadence, s.periodStartPreference, timezone);
      return { ...s, periodStartMs: window.startMs, periodEndMs: window.endMs };
    });

    const earliestStartMs = standardWindows.reduce(
      (min, s) => Math.min(min, s.periodStartMs),
      nowMs
    );

    const earliestTimestamp = admin.firestore.Timestamp.fromMillis(earliestStartMs);
    const logsSnap = await db
      .collection(`users/${memberUid}/activityLogs`)
      .where('occurredAt', '>=', earliestTimestamp)
      .orderBy('occurredAt', 'desc')
      .get();

    const logs = [];
    logsSnap.forEach((doc) => {
      const data = doc.data();
      if (!data.deletedAt) {
        logs.push({
          standardId: data.standardId,
          value: data.value,
          occurredAtMs: data.occurredAt.toMillis(),
        });
      }
    });

    // Build synthetic history entries for computeMemberStats
    const visibleHistory = standardWindows.map((s) => {
      const windowLogs = logs.filter(
        (log) =>
          log.standardId === s.id &&
          log.occurredAtMs >= s.periodStartMs &&
          log.occurredAtMs < s.periodEndMs
      );
      const total = windowLogs.reduce((sum, log) => sum + log.value, 0);
      const safeMinimum = Math.max(s.minimum, 0);
      const ratio = safeMinimum === 0 ? 1 : Math.min(total / safeMinimum, 1);
      const progressPercent = Number((ratio * 100).toFixed(2));

      let status = 'In Progress';
      if (total >= s.minimum) status = 'Met';
      else if (nowMs >= s.periodEndMs) status = 'Missed';

      return { standardId: s.id, status, progressPercent };
    });

    const { metCount, totalCount, avgCompletion } = computeMemberStats(visibleHistory, visibleStandards);

    memberResults.push({
      uid: memberUid,
      displayName: memberInfo.displayName || 'Unknown',
      joinedAtMs: memberInfo.joinedAtMs || 0,
      isAdmin: group.createdByUid === memberUid,
      stats: {
        metCount,
        totalCount,
        avgCompletion,
      },
    });
  }

  return {
    groupId,
    groupName: group.name,
    inviteCode: group.inviteCode,
    adminUid: group.createdByUid,
    members: memberResults,
  };
});

exports.getMemberStandards = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  const memberUid = (request.data && request.data.memberUid) || '';
  const timezone = (request.data && request.data.timezone) || 'UTC';

  if (!groupId || !memberUid) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId and memberUid are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const groupSnap = await db.doc(`accountabilityGroups/${groupId}`).get();
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (!group.memberUids.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'You are not a member of this group.');
  }
  if (!group.memberUids.includes(memberUid)) {
    throw new functions.https.HttpsError('failed-precondition', 'Target user is not in this group.');
  }

  // Fetch all standards then filter in code — Firestore where('field', '==', null)
  // doesn't match docs where the field is missing entirely, so filtering in code
  // is more reliable across docs created at different schema versions.
  const standardsSnap = await db
    .collection(`users/${memberUid}/standards`)
    .get();

  const standards = [];
  standardsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.state !== 'active') return;
    if (data.deletedAt) return;
    if (data.hiddenFromGroup) return;
    standards.push({
      id: doc.id,
      name: data.name,
      summary: data.summary,
      minimum: data.minimum,
      unit: data.unit,
      cadence: data.cadence,
      periodStartPreference: data.periodStartPreference,
    });
  });

  // Compute current period windows and fetch logs to calculate live progress
  const nowMs = Date.now();
  const standardWindows = standards.map((s) => {
    const window = computePeriodWindow(nowMs, s.cadence, s.periodStartPreference, timezone);
    return { ...s, periodStartMs: window.startMs, periodEndMs: window.endMs };
  });

  // Find the earliest period start across all standards to scope the logs query
  const earliestStartMs = standardWindows.reduce(
    (min, s) => Math.min(min, s.periodStartMs),
    nowMs
  );

  // Fetch activity logs since the earliest period start.
  // The Firestore field is 'occurredAt' (a Timestamp), not 'occurredAtMs'.
  const earliestTimestamp = admin.firestore.Timestamp.fromMillis(earliestStartMs);
  const logsSnap = await db
    .collection(`users/${memberUid}/activityLogs`)
    .where('occurredAt', '>=', earliestTimestamp)
    .orderBy('occurredAt', 'desc')
    .get();

  const logs = [];
  logsSnap.forEach((doc) => {
    const data = doc.data();
    if (!data.deletedAt) {
      logs.push({
        standardId: data.standardId,
        value: data.value,
        occurredAtMs: data.occurredAt.toMillis(),
      });
    }
  });

  // Compute progress for each standard from logs within its period window
  const result = standardWindows.map((s) => {
    const windowLogs = logs.filter(
      (log) =>
        log.standardId === s.id &&
        log.occurredAtMs >= s.periodStartMs &&
        log.occurredAtMs < s.periodEndMs
    );
    const total = windowLogs.reduce((sum, log) => sum + log.value, 0);
    const safeMinimum = Math.max(s.minimum, 0);
    const ratio = safeMinimum === 0 ? 1 : Math.min(total / safeMinimum, 1);
    const progressPercent = Number((ratio * 100).toFixed(2));

    let status = 'In Progress';
    if (total >= s.minimum) status = 'Met';
    else if (nowMs >= s.periodEndMs) status = 'Missed';

    return {
      id: s.id,
      name: s.name,
      summary: s.summary,
      minimum: s.minimum,
      unit: s.unit,
      cadence: s.cadence,
      status,
      progressPercent,
      total,
      periodStartMs: s.periodStartMs,
      periodEndMs: s.periodEndMs,
    };
  });

  return { standards: result };
});

exports.getMemberStandardDetail = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const groupId = (request.data && request.data.groupId) || '';
  const memberUid = (request.data && request.data.memberUid) || '';
  const standardId = (request.data && request.data.standardId) || '';

  if (!groupId || !memberUid || !standardId) {
    throw new functions.https.HttpsError('invalid-argument', 'groupId, memberUid, and standardId are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Validate caller is in the group
  const groupSnap = await db.doc(`accountabilityGroups/${groupId}`).get();
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Group not found.');
  }

  const group = groupSnap.data();
  if (!group.memberUids.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'You are not a member of this group.');
  }
  if (!group.memberUids.includes(memberUid)) {
    throw new functions.https.HttpsError('failed-precondition', 'Target user is not in this group.');
  }

  // Fetch the standard
  const standardSnap = await db.doc(`users/${memberUid}/standards/${standardId}`).get();
  if (!standardSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Standard not found.');
  }

  const standard = standardSnap.data();
  if (standard.hiddenFromGroup) {
    throw new functions.https.HttpsError('permission-denied', 'This standard is hidden from the group.');
  }
  if (standard.deletedAt) {
    throw new functions.https.HttpsError('not-found', 'Standard not found.');
  }

  // Fetch activity history for this standard
  const historySnap = await db
    .collection(`users/${memberUid}/activityHistory`)
    .where('standardId', '==', standardId)
    .orderBy('periodStartMs', 'desc')
    .limit(50)
    .get();

  const history = [];
  historySnap.forEach((doc) => {
    const data = doc.data();
    if (!data.deletedAtMs) {
      history.push({
        id: doc.id,
        periodStartMs: data.periodStartMs,
        periodEndMs: data.periodEndMs,
        periodLabel: data.periodLabel,
        periodKey: data.periodKey,
        status: data.status,
        progressPercent: data.progressPercent,
        total: data.total,
        currentSessions: data.currentSessions,
        targetSessions: data.targetSessions,
        standardSnapshot: data.standardSnapshot,
      });
    }
  });

  return {
    standard: {
      id: standardSnap.id,
      name: standard.name,
      minimum: standard.minimum,
      unit: standard.unit,
      cadence: standard.cadence,
      state: standard.state,
      summary: standard.summary,
      sessionConfig: standard.sessionConfig,
    },
    history,
  };
});

