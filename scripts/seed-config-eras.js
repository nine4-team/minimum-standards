/**
 * Seed ConfigEras from Existing Activity History Snapshots
 *
 * For each standard, walks its activityHistory docs chronologically and detects
 * config changes by comparing consecutive standardSnapshot values. Builds a
 * configEras array and writes it back to the standard doc.
 *
 * Also identifies and soft-deletes known orphaned docs (periodStartMs that
 * doesn't align with the detected era's period boundaries).
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
 *   node scripts/seed-config-eras.js [--dry-run] [--user=<userId>]
 *
 * Flags:
 *   --dry-run   Print what would be written without making changes
 *   --user=ID   Only process standards for this userId (default: all users)
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const USER_FILTER = args.find(a => a.startsWith('--user='))?.split('=')[1] ?? null;

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();

// Compare two standardSnapshot configs for equality (ignoring summary for change detection)
function configsEqual(a, b) {
  if (a.minimum !== b.minimum) return false;
  if (a.unit !== b.unit) return false;
  if (a.cadence?.interval !== b.cadence?.interval) return false;
  if (a.cadence?.unit !== b.cadence?.unit) return false;
  if (a.sessionConfig?.sessionsPerCadence !== b.sessionConfig?.sessionsPerCadence) return false;
  if (a.sessionConfig?.volumePerSession !== b.sessionConfig?.volumePerSession) return false;
  if (JSON.stringify(a.periodStartPreference ?? null) !== JSON.stringify(b.periodStartPreference ?? null)) return false;
  return true;
}

function snapshotToEra(snapshot, effectiveFromMs) {
  const era = {
    effectiveFromMs,
    minimum: snapshot.minimum,
    unit: snapshot.unit,
    cadence: snapshot.cadence,
    sessionConfig: snapshot.sessionConfig,
    summary: snapshot.summary ?? `${snapshot.minimum} ${snapshot.unit} / ${snapshot.cadence?.unit ?? 'period'}`,
  };
  if (snapshot.periodStartPreference) {
    era.periodStartPreference = snapshot.periodStartPreference;
  }
  return era;
}

async function processUser(userId) {
  console.log(`\nProcessing user: ${userId}`);

  const standardsSnap = await db
    .collection('users')
    .doc(userId)
    .collection('standards')
    .get();

  for (const standardDoc of standardsSnap.docs) {
    const standard = { id: standardDoc.id, ...standardDoc.data() };
    await processStandard(userId, standard);
  }
}

async function processStandard(userId, standard) {
  console.log(`  Standard ${standard.id} (activity: ${standard.activityId})`);

  // Query all history docs for this standard, ordered oldest-first
  const historySnap = await db
    .collection('users')
    .doc(userId)
    .collection('activityHistory')
    .where('standardId', '==', standard.id)
    .orderBy('referenceTimestampMs', 'asc')
    .get();

  if (historySnap.empty) {
    console.log(`    No history docs — skipping`);
    return;
  }

  const createdAtMs = standard.createdAt?.toMillis?.() ?? standard.createdAtMs ?? Date.now();

  // Walk docs and detect config change points
  const eras = [];
  let prevSnapshot = null;

  for (const docSnap of historySnap.docs) {
    const data = docSnap.data();
    if (data.deletedAtMs) continue; // skip already-deleted

    const snapshot = data.standardSnapshot;
    if (!snapshot) continue;

    if (prevSnapshot === null) {
      // First non-deleted doc — create initial era from creation time
      eras.push(snapshotToEra(snapshot, createdAtMs));
    } else if (!configsEqual(prevSnapshot, snapshot)) {
      // Config changed — new era starts at this doc's reference timestamp
      eras.push(snapshotToEra(snapshot, data.referenceTimestampMs ?? data.periodStartMs));
    }

    prevSnapshot = snapshot;
  }

  // Final era should reflect current standard config (in case it changed after last history doc)
  if (standard.minimum !== undefined && prevSnapshot) {
    const currentConfig = {
      minimum: standard.minimum,
      unit: standard.unit,
      cadence: standard.cadence,
      sessionConfig: standard.sessionConfig,
      periodStartPreference: standard.periodStartPreference,
    };
    const lastEra = eras[eras.length - 1];
    if (lastEra && !configsEqual(lastEra, currentConfig)) {
      eras.push(snapshotToEra(
        { ...currentConfig, summary: standard.summary },
        standard.updatedAt?.toMillis?.() ?? Date.now()
      ));
    }
  }

  console.log(`    Found ${eras.length} era(s) from ${historySnap.size} history docs`);
  eras.forEach((era, i) => {
    console.log(`      Era ${i + 1}: effectiveFrom=${new Date(era.effectiveFromMs).toISOString()} min=${era.minimum} ${era.unit}/${era.cadence?.unit}`);
  });

  if (!DRY_RUN) {
    await db
      .collection('users')
      .doc(userId)
      .collection('standards')
      .doc(standard.id)
      .update({ configEras: eras });
    console.log(`    ✓ Written configEras to standard`);
  } else {
    console.log(`    [DRY RUN] Would write configEras to standard`);
  }
}

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY RUN MODE — no writes will be made ===');
  }

  if (USER_FILTER) {
    await processUser(USER_FILTER);
  } else {
    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} user(s)`);
    for (const userDoc of usersSnap.docs) {
      await processUser(userDoc.id);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
