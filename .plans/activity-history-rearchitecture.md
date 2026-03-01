# Activity History Rearchitecture

## Context

The activity history system has no record of historical standard configs. When a standard's cadence, minimum, or period start preference changes, the old config is overwritten in-place. The only historical record is the `standardSnapshot` embedded in each `activityHistory` doc — but the engine overwrites these with the current config during backfill/regeneration, corrupting historical accuracy.

This causes three user-facing bugs:
1. **Wrong snapshots on regenerated docs** — backfilled periods show today's goal, not the goal at the time
2. **Orphaned docs from preference changes** — `deleteDoc` fails silently against `allow delete: if false`, leaving phantom overlapping periods and false "Missed" statuses
3. **No way to delete bad records** — users can't clean up corrupted data

## Approach

Add a `configEras` array to the Standard document that records timestamped config snapshots. Make the engine era-aware (use the right config for each period). Use soft-delete for history docs so users can remove bad records without the engine regenerating them.

---

## Phase 1: Data Model (shared-model)

### 1a. Add `ConfigEra` type
**File:** `packages/shared-model/src/types.ts`

```typescript
export type ConfigEra = {
  effectiveFromMs: TimestampMs;
  minimum: number;
  unit: string;
  cadence: StandardCadence;
  sessionConfig: StandardSessionConfig;
  summary: string;
  periodStartPreference?: PeriodStartPreference;
};
```

Add to `Standard` type: `configEras?: ConfigEra[]`

### 1b. Add `deletedAtMs` to ActivityHistoryDoc
**File:** `packages/shared-model/src/types.ts`

Add optional field: `deletedAtMs?: TimestampMs | null`

### 1c. Zod schemas
**File:** `packages/shared-model/src/schemas.ts`

- Add `configEraSchema` (validates each era entry)
- Add `configEras: z.array(configEraSchema).optional()` to standard schema
- Add `deletedAtMs: timestampMsSchema.nullable().optional()` to activityHistoryDocSchema

### 1d. Era resolution helper
**New file:** `packages/shared-model/src/config-eras.ts`

- `resolveEraForTimestamp(standard, timestampMs)` — returns the `ConfigEra` in effect at a given time, or `null` if no eras exist (caller falls back to current standard config)
- `buildSnapshotFromEra(era)` — converts a `ConfigEra` to `ActivityHistoryStandardSnapshot`
- `buildSnapshotFromStandard(standard)` — converts current standard config to snapshot (existing pattern, just extracted)

### 1e. Tests
**New file:** `packages/shared-model/src/__tests__/config-eras.test.ts`

- No eras → returns null
- Single era → covers all timestamps
- Multiple eras → resolves correctly by timestamp
- Timestamp on boundary → resolves to new era
- Timestamp before first era → returns first era (it covers the standard's entire lifetime)

---

## Phase 2: Firestore Rules

### 2a. activityHistory rules
**File:** `firebase/firestore.rules`

- Add `'deletedAtMs'` to `hasOnlyKeys` in `validActivityHistoryDoc()`
- Add validation: `(!('deletedAtMs' in data) || data.deletedAtMs == null || isTimestampMs(data.deletedAtMs))`
- Keep `allow delete: if false` (we use soft-delete, not hard-delete)

### 2b. standards rules
**File:** `firebase/firestore.rules`

- Add `'configEras'` to `hasOnlyKeys` in `validStandard()`
- Add validation: `(!('configEras' in data) || (data.configEras is list && data.configEras.size() <= 50))`

### 2c. Deploy rules before app update
Rules must be deployed FIRST — the new fields are optional, so existing app versions continue to work. But the new app version will write `deletedAtMs` and `configEras`, which would fail against old rules.

---

## Phase 3: Write Path Changes

### 3a. writeActivityHistoryPeriod — include deletedAtMs
**File:** `packages/firestore-model/src/activity-history-helpers.ts` (line 179)

Add `deletedAtMs: null` to the payload. This is required because `hasOnlyKeys` will now expect the field.

### 3b. Add softDeleteActivityHistoryDoc helper
**File:** `packages/firestore-model/src/activity-history-helpers.ts`

New function: reads the existing doc, writes it back with `deletedAtMs: Date.now()` and updated `generatedAtMs`. Full overwrite (required by `hasOnlyKeys`).

### 3c. Add getActivityHistoryDoc helper
**File:** `packages/firestore-model/src/activity-history-helpers.ts`

New function: `getDoc` by deterministic doc ID. Needed by the engine for check-before-write and by recompute for snapshot preservation.

### 3d. Fix recomputeActivityHistoryPeriod
**File:** `apps/mobile/src/utils/activityHistoryRecompute.ts`

Two changes:
1. **Preserve existing snapshot on log-edit recompute:** Before writing, `getDoc` the existing doc. If it exists and is not soft-deleted, use its `standardSnapshot` instead of building one from the current standard. If it doesn't exist, resolve the config era for the period and build the snapshot from that.
2. **Orphan cleanup — soft-delete instead of hard-delete:** Replace `deleteDoc(oldDocRef).catch(...)` (line 117) with `softDeleteActivityHistoryDoc(...)`. This will actually work now instead of failing silently.

### 3e. updateStandard — write configEras
**File:** `apps/mobile/src/hooks/useStandards.ts` (line 278-295)

When `shouldRecompute` is true:
1. Read current `configEras` from the standard (may be undefined)
2. If empty/undefined: create initial era from `previousStandard` config with `effectiveFromMs = standard.createdAtMs`
3. Append new era from the updated config with `effectiveFromMs = Date.now()`
4. Include `configEras` in the Firestore update payload

### 3f. createStandard — initialize configEras
**File:** `apps/mobile/src/hooks/useStandards.ts` (line 192)

Add `configEras: []` to the create payload. Eras are empty initially — the first era is written on the first config change. If a standard's config never changes, `resolveEraForTimestamp` returns null and the engine uses the current (unchanged) config, which is correct.

### 3g. Wire soft-delete binding for React Native
**File:** `apps/mobile/src/utils/activityHistoryFirestore.ts`

Add binding for the new `softDeleteActivityHistoryDoc` and `getActivityHistoryDoc` helpers.

---

## Phase 4: Engine Changes

### 4a. Check-before-write
**File:** `apps/mobile/src/hooks/useActivityHistoryEngine.ts` (line 226-270)

Before writing each period doc:
```
const existingDoc = await getActivityHistoryDoc({ userId, activityId, standardId, periodStartMs: window.startMs });
if (existingDoc) {
  currentReference = window.endMs;
  continue; // preserve existing doc's snapshot
}
```

### 4b. Era-resolved snapshots for new docs
Replace lines 234-258 (snapshot construction from current standard) with:
```
const era = resolveEraForTimestamp(standard, window.startMs);
const standardSnapshot = era
  ? buildSnapshotFromEra(era)
  : buildSnapshotFromStandard(standard);
```

Also use the era's `minimum` (or current standard's if no era) for `derivePeriodStatus` and `progressPercent` in `computeRollupsForPeriod`.

### 4c. Era-aware period walking
When the era changes between periods (different cadence), the engine naturally handles this because it recalculates `calculatePeriodWindow` at each step. The era lookup happens per-period, so the cadence used to calculate the window changes at the right time.

One edge case: calendar snapping can produce a window start BEFORE `currentReference` (e.g., switching from daily to weekly — the weekly window snaps to Monday, which is before where we are). This is acceptable — the doc ID will be unique, no collision. The first period of a new cadence may partially overlap the last period of the old cadence, which is a one-time artifact of the transition.

### 4d. Filter soft-deleted docs in getLatestHistoryForStandard
**File:** `packages/firestore-model/src/activity-history-helpers.ts` (line 243-248)

Change `limit(1)` to `limit(5)`, then client-side filter out docs where `deletedAtMs` is truthy. Return the first non-deleted doc. This avoids needing a Firestore field-existence migration.

### 4e. Filter soft-deleted docs in listenActivityHistoryForActivity
**File:** `packages/firestore-model/src/activity-history-helpers.ts` (onSnapshot callback)

Add client-side filter: skip docs where `deletedAtMs` is truthy.

---

## Phase 5: Delete UI

### 5a. Add delete action to period cards
**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx`

Add a long-press or swipe action on history period cards (not current-period cards) that triggers soft-delete. Include a confirmation dialog ("Delete this period record? This removes it from your history and stats.").

### 5b. Implement delete handler
Call `softDeleteActivityHistoryDoc` with the doc ID built from `activityId + standardId + periodStartMs`. The real-time listener automatically removes the doc from the UI on the next snapshot.

---

## Phase 6: Migration Script

### 6a. Seed configEras from existing history snapshots
**New file:** `scripts/seed-config-eras.js`

For each standard (including soft-deleted):
1. Query all `activityHistory` docs for that standard, ordered by `referenceTimestampMs` asc
2. Walk through chronologically, comparing `standardSnapshot` configs
3. When the snapshot config differs from the previous one, create an era entry with `effectiveFromMs` = that doc's `referenceTimestampMs`
4. First era gets `effectiveFromMs = standard.createdAtMs`
5. Final era = current standard config
6. Write `configEras` array to the standard doc

### 6b. deletedAtMs on existing docs — skip
Not needed. Keep `deletedAtMs` optional in `hasOnlyKeys`. Existing docs without the field pass validation on READ. New writes always include it. `getLatestHistoryForStandard` uses client-side filtering (Phase 4d) to handle missing field.

### 6c. Clean up known orphaned docs
After seeding eras, identify and soft-delete orphaned docs. An orphan is a doc whose `periodStartMs` doesn't align with any config era's period boundaries.

For the immediate problem (overlapping docs from Wed→Mon change), the migration script identifies and soft-deletes the orphan.

---

## Phase 7: Tests

### Unit tests
- `resolveEraForTimestamp` — all edge cases (Phase 1e)
- `recomputeActivityHistoryPeriod` — preserves snapshot on log-edit, uses era on backfill
- `mergeActivityHistoryRows` — correctly filters soft-deleted docs

### Engine behavior tests
- Engine skips existing docs (check-before-write)
- Engine uses era-resolved config for new docs
- Engine handles era transition (different cadence between consecutive periods)
- Engine skips soft-deleted docs when finding walk-forward start

### Firestore rules tests
- History doc with `deletedAtMs: null` accepted
- History doc with `deletedAtMs: <number>` accepted
- History doc without `deletedAtMs` accepted (backward compat)
- Standard with `configEras` array accepted
- Standard with `configEras` > 50 entries rejected

---

## Critical Files

| File | Changes |
|------|---------|
| `packages/shared-model/src/types.ts` | Add ConfigEra, configEras on Standard, deletedAtMs on ActivityHistoryDoc |
| `packages/shared-model/src/schemas.ts` | Add configEraSchema, update standard + history schemas |
| `packages/shared-model/src/config-eras.ts` | NEW — resolveEraForTimestamp, buildSnapshotFromEra |
| `firebase/firestore.rules` | Add deletedAtMs + configEras to allowed fields |
| `packages/firestore-model/src/activity-history-helpers.ts` | Add deletedAtMs to payload, add softDelete + getDoc helpers, filter deleted in queries |
| `apps/mobile/src/utils/activityHistoryRecompute.ts` | Preserve snapshot on log-edit, soft-delete orphans |
| `apps/mobile/src/hooks/useStandards.ts` | Write configEras on create/update |
| `apps/mobile/src/hooks/useActivityHistoryEngine.ts` | Check-before-write, era-resolved snapshots |
| `apps/mobile/src/utils/activityHistoryFirestore.ts` | Wire new bindings |
| `apps/mobile/src/screens/ActivityHistoryScreen.tsx` | Delete UI on period cards |
| `scripts/seed-config-eras.js` | Migration: seed eras from existing snapshots |

## Verification

1. **Unit tests pass** — run shared-model and mobile test suites
2. **Firestore rules tests pass** — deploy rules to emulator, run rules test suite
3. **Manual test: config change** — change a standard's minimum, verify new era is created, verify engine uses old era for historical periods
4. **Manual test: delete record** — long-press a history card, confirm delete, verify it disappears and doesn't come back
5. **Manual test: orphan cleanup** — change periodStartPreference, verify old-boundary doc is soft-deleted and new-boundary doc is correct
6. **Migration script** — run against prod data, verify configEras are seeded correctly
