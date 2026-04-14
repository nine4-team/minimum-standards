const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');

admin.initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

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

