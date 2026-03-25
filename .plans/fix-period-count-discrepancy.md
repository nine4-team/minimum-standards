# Fix: Scorecard Summary Period Count Discrepancy

## Context

The Scorecard Summary card shows "6/6" under "Periods" for an activity that has 10 merged rows (12 Firestore docs, 2 dropped by dedup). The detail screen shows all 10 period cards. Both screens should agree.

### Root causes (confirmed via runtime logs + code audit)

1. **Stale `status` on persisted Firestore docs (the real bug)**: The engine writes `status: derivePeriodStatus(total, minimum, nowMs, periodEndMs)` at doc creation time. If `nowMs < periodEndMs` at that moment, the doc gets `status: 'In Progress'`. Once the period actually ends, that status is **never updated** — it stays "In Progress" forever. `mergeActivityHistoryRows` copies `persisted.status` directly at line 149 of `activityHistory.ts` without re-deriving. 4 rows for this activity have stale "In Progress" status.

2. **Display format compounds the stale status**: The summary card shows `metCount/completedCount` (6/6) where `completedCount` only counts `status !== 'In Progress'`. Those 4 stale "In Progress" rows are invisible. The detail screen shows all 10 cards with no visible distinction (since `isCurrentPeriod: false` on persisted rows, no "(In Progress)" suffix appears).

3. **Navigation regression**: `ActivityHistoryScreen` line 105-118 `useEffect` resets `selectedActivityId = null` when `sortedActivities` is empty (loading), then picks `sortedActivities[0]` instead of the `activityId` prop.

4. **Dedup dropping 2 rows**: Two pairs of Firestore docs with timestamps ~2h apart recalculate to the same period boundary due to period start preference changes. Data quality issue, not a code bug.

5. **Orphaned test**: `computePeriodStats.test.ts` imports `computePeriodStats` from `activityHistory.ts` but the function was never implemented. The test file is dead code.

### Additional issue: mid-period preference changes create orphaned Firestore docs

When a user changes `periodStartPreference` (e.g., week start Monday → Wednesday), `calculatePeriodWindow` returns a different `startMs`, producing a different doc ID. `recomputeActivityHistoryPeriod` writes the new doc but **never deletes the old one**. Both docs persist in Firestore, creating overlapping period coverage. This is the source of the 2 rows dropped by dedup in the runtime logs — pairs of docs from preference changes that recalculate to the same boundary.

Note: cadence and minimum changes are safe — they produce the same `startMs` so the doc ID is unchanged and the existing doc gets overwritten.

## Plan

### Step 1: Re-derive status at read time in `mergeActivityHistoryRows`

**File:** `apps/mobile/src/utils/activityHistory.ts` (lines 131-153)

This is the core fix. When building merged rows from persisted docs, re-derive `status` using `derivePeriodStatus` with a fresh `nowMs` instead of copying `persisted.status`:

- Add `nowMs: number` parameter to `mergeActivityHistoryRows`
- For each persisted row, after recalculating boundaries, call:
  `derivePeriodStatus(persisted.total, persisted.standardSnapshot.minimum, nowMs, boundaries.endMs)`
- This correctly transitions stale "In Progress" docs to "Met" or "Missed" at display time
- Synthetic rows already derive status fresh, so no change needed there

**Callers to update:**
- `useScorecardSummary.ts` line 114-118: pass `nowMs: Date.now()` (already computed nearby at line 136)
- `ActivityHistoryScreen.tsx` line 179-183: pass `nowMs` (already in state at line 72)

**Why this is correct:**
- `derivePeriodStatus` is pure: `total >= minimum` → Met, `nowMs >= periodEndMs` → Missed, else In Progress
- The snapshot's `minimum` is the right value (what was in effect when the period was active)
- `boundaries.endMs` is recalculated from the snapshot's cadence (consistent)
- Only the staleness of `nowMs` changes — we use current time instead of write time

### Step 2: Clean up orphaned docs on preference/cadence change

**File:** `apps/mobile/src/utils/activityHistoryRecompute.ts`

When the period boundary shifts due to a config change, the old doc must be deleted. Approach:

- Add optional `previousStandard?: Standard` parameter to `RecomputeActivityHistoryPeriodParams`
- Before writing the new doc, if `previousStandard` is provided:
  1. Calculate the old period window using `previousStandard.cadence` + `previousStandard.periodStartPreference`
  2. Build the old doc ID via `buildActivityHistoryDocId(activityId, standardId, oldWindow.startMs)`
  3. Build the new doc ID via `buildActivityHistoryDocId(activityId, standardId, newWindow.startMs)`
  4. If old doc ID !== new doc ID, delete the old doc after writing the new one
- This handles preference changes (Monday→Wednesday shifts startMs) and would also handle any future cadence changes that shift boundaries

**File:** `apps/mobile/src/hooks/useStandards.ts` (line 294)

- Update `triggerActivityHistoryRecompute` to accept and pass `previousStandard`
- In `updateStandard`, pass `previousStandard` when calling the recompute (already available at line 236)

**Why this is safe:**
- `buildActivityHistoryDocId` is deterministic — same inputs always produce the same ID
- We only delete when old ID !== new ID (boundary actually shifted)
- `writeActivityHistoryPeriod` uses `setDoc` (overwrite), so the new doc is written first, then we clean up the old — no data loss window
- The delete is fire-and-forget with error logging, same pattern as the existing recompute call

### Step 3: Fix navigation — respect `activityId` prop

**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx` (lines 105-118)

Replace the current `useEffect`:
- When `sortedActivities` is empty (loading), do nothing (don't reset to null)
- When validating, prefer the `activityId` prop if it exists in `sortedActivities`, then fall back to current `selectedActivityId`, then `sortedActivities[0]`

### Step 4: Fix summary card display — show total periods

**File:** `apps/mobile/src/utils/scorecardSummary.ts`
- Add `totalPeriods: number` to `ActivitySummaryCard` interface
- Set to total row count (all statuses) — after status re-derivation, most rows will be Met/Missed, but any genuinely current "In Progress" rows should still be counted in the total

**File:** `apps/mobile/src/components/ActivitySummaryCard.tsx` (line 51)
- Change display from `{card.metCount}/{card.completedCount}` to `{card.metCount}/{card.totalPeriods}`

### Step 5: Remove diagnostic logging

- `apps/mobile/src/hooks/useScorecardSummary.ts` — remove `[SUMMARY-DIAG]` console.logs (lines 119-127)
- `apps/mobile/src/screens/ActivityHistoryScreen.tsx` — remove all `[DETAIL-DIAG]` console.logs
- `apps/mobile/src/utils/scorecardSummary.ts` — remove `[SUMMARY-DIAG]` console.logs (lines 77-82)

### Step 6: Clean up orphaned test, write new tests

**Delete:** `apps/mobile/src/utils/__tests__/computePeriodStats.test.ts` (imports non-existent function)

**New file:** `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts`
- Test `buildActivitySummaryCards` with:
  - All Met rows → `metCount === totalPeriods`, `percentMet === 100`
  - All Missed rows → `metCount === 0`, `completedCount === totalPeriods`
  - Mixed Met/Missed/In Progress → correct counts for each
  - All In Progress → `completedCount === 0`, `totalPeriods > 0`
  - Empty rows → all zeros

**New file:** `apps/mobile/src/utils/__tests__/mergeActivityHistoryRows.test.ts`
- Test status re-derivation:
  - Persisted row with `status: 'In Progress'` + `periodEndMs < nowMs` → merged row has `status: 'Missed'` (if total < minimum) or `'Met'` (if total >= minimum)
  - Persisted row with `status: 'In Progress'` + `periodEndMs > nowMs` → stays `'In Progress'`
  - Persisted row with `status: 'Met'` → stays `'Met'` regardless of nowMs
- Test dedup: two rows with same `(standardId, recalculatedStartMs)` → only first survives
- Test orphan cleanup: mock scenario where old and new doc IDs differ → verify old doc deleted

## Files to modify

1. `apps/mobile/src/utils/activityHistory.ts` — re-derive status in `mergeActivityHistoryRows`
2. `apps/mobile/src/utils/activityHistoryRecompute.ts` — delete orphaned docs when boundary shifts
3. `apps/mobile/src/hooks/useStandards.ts` — pass `previousStandard` to recompute
4. `apps/mobile/src/hooks/useScorecardSummary.ts` — pass `nowMs`, remove diag logs
5. `apps/mobile/src/screens/ActivityHistoryScreen.tsx` — pass `nowMs`, fix navigation, remove diag logs
6. `apps/mobile/src/utils/scorecardSummary.ts` — add `totalPeriods`, remove diag logs
7. `apps/mobile/src/components/ActivitySummaryCard.tsx` — display `metCount/totalPeriods`
8. `apps/mobile/src/utils/__tests__/computePeriodStats.test.ts` — delete (orphaned)
9. `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts` — new tests
10. `apps/mobile/src/utils/__tests__/mergeActivityHistoryRows.test.ts` — new tests

## Verification

1. Run `npx jest scorecardSummary mergeActivityHistoryRows` — all tests pass
2. Run the app:
   - Summary card should show `metCount/totalPeriods` (e.g., "6/10" → likely "10/10" after status fix)
   - Summary and detail should agree on period counts for the same activity/time range
3. Tap a summary card → detail screen pre-selects the correct activity
4. Change a standard's period start preference mid-period → verify only one doc exists for that period (no orphan)
5. Verify no `[SUMMARY-DIAG]` or `[DETAIL-DIAG]` logs in console
