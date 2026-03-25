# Fix Scorecard Period Count and Completion Rate Bugs

## Context

The scorecard has two screens: a **summary** (one card per activity) and a **detail** (period history rows for a single activity). Both show incorrect counts:

- **Ab Wheel** has 1 standard and only 2 period rows visible in detail, but summary says 4 periods
- **Completion rates** across activities appear wrong (e.g., "5 of 8" when more should be completed)

The original plan only addressed excluding in-progress periods from `totalPeriods`. Investigation revealed deeper, systemic issues.

## Root Causes

### 1. Summary pipeline includes rows from orphaned/deleted standards (primary cause of inflated counts)

The Firestore query `where('activityId', '==', activityId)` returns ALL `activityHistory` docs for that activity — including docs from standards that were soft-deleted (`deletedAt != null`), archived, or had their cadence changed (creating new docs without cleaning up old ones).

The **detail screen** filters rows by `relevantStandardIds` (line 192 of `ActivityHistoryScreen.tsx`), which only includes standards the user can currently see. The **summary pipeline** in `useScorecardSummary.ts` does **NO** standardId filtering — it passes all rows straight through to `buildActivitySummaryCards`.

This means:
- Detail: filters to known standards → shows 2 rows
- Summary: no filter → includes orphaned rows → shows 4

### 2. Summary counts raw rows, not unique time periods

`totalPeriods = rows.length` (scorecardSummary.ts:78) counts every merged row. Even with a single standard, orphaned rows inflate this. With multiple standards per activity, each period generates N rows (one per standard), further inflating the count.

### 3. Display shows `metCount/totalPeriods` but should show `metCount/completedCount`

Per user preference, the "Periods" stat should show met out of completed (excluding in-progress), not met out of total.

## Plan

### Step 1: Add standardId filtering to the summary pipeline

**File:** `apps/mobile/src/hooks/useScorecardSummary.ts`

After merging rows (line 119), filter each activity's rows to only include rows whose `standardId` matches a known (non-deleted) standard. The `standards` array from `useStandards()` already excludes soft-deleted standards (`where('deletedAt', '==', null)`).

```
// After mergeActivityHistoryRows, before storing in result:
const knownStandardIds = new Set(standards.map(s => s.id));
result[activityId] = merged.filter(row => knownStandardIds.has(row.standardId));
```

This makes the summary consistent with the detail screen's filtering.

### Step 2: Deduplicate periods by time window in `buildActivitySummaryCards`

**File:** `apps/mobile/src/utils/scorecardSummary.ts`

Extract a pure, testable `aggregatePeriodStats` function that groups rows by `periodStartMs` (unique time periods) and aggregates across standards within each period:

- A period is **"completed"** if all standards' rows for that period are NOT `'In Progress'`
- A period is **"met"** if all standards' rows for that period have `status === 'Met'`
- `totalPeriods` = count of unique completed time periods (excluding in-progress, per user preference)
- `metCount` = count of met periods
- `completedCount` = same as totalPeriods (since we're counting only completed periods)

Replace the current inline loop (lines 60-78) with a call to `aggregatePeriodStats`. `totalVolume` stays as a raw sum across all rows (volume is additive).

Update `countMetLabel` format from `metCount/totalPeriods` to `metCount/completedCount` and rename for clarity.

### Step 3: Update `ActivitySummaryCard` display

**File:** `apps/mobile/src/components/ActivitySummaryCard.tsx`

Change the Periods display from `card.metCount/card.totalPeriods` to `card.metCount/card.completedCount` (line 51). Since Step 2 makes `completedCount` the correct denominator, this just updates the reference.

### Step 4: Update tests

**File:** `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts`

- Add `describe('aggregatePeriodStats')` with direct unit tests:
  - Single standard, all Met → totalPeriods = N, metCount = N
  - Single standard, mix of Met/Missed/In Progress → correct exclusion of in-progress
  - Multi-standard activity: 2 standards × 2 periods = 4 rows → totalPeriods = 2
  - Multi-standard: period Met only if ALL standards Met
  - Multi-standard: period not completed if ANY standard In Progress
  - Edge: empty rows → all zeros
- Update existing `buildActivitySummaryCards` test expectations:
  - Test 2 ("All In Progress"): `totalPeriods` becomes 0 (since in-progress excluded), or update test rows to have distinct `periodStartMs`
  - All other tests: update `totalPeriods` and `countMetLabel` assertions to reflect new completed-only counting

### Step 5: Fix detail screen stats panel consistency

**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx`

The stats panel (lines 317-347) also counts per-row instead of per-period. Import and use the same `aggregatePeriodStats` function (or its logic adapted for `clippedRows`) so the detail stats are consistent with the summary.

### Step 6: Detail screen — label current period, show period dates

**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx`

- Current period rows already show "(In Progress)" in the period label (line 606) — verify this works
- Add `periodLabel` as secondary text on each period card (if not already visible)

## Files to Modify

| File | Change |
|------|--------|
| `apps/mobile/src/utils/scorecardSummary.ts` | Extract `aggregatePeriodStats`, fix period counting and display label |
| `apps/mobile/src/hooks/useScorecardSummary.ts` | Add standardId filtering after merge |
| `apps/mobile/src/components/ActivitySummaryCard.tsx` | Update Periods display to use `completedCount` |
| `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts` | Add multi-standard tests, update existing assertions |
| `apps/mobile/src/screens/ActivityHistoryScreen.tsx` | Fix stats panel to aggregate by period |

## Key Functions to Reuse

- `mergeActivityHistoryRows` in `apps/mobile/src/utils/activityHistory.ts` — already handles dedup by (standardId, periodStartMs)
- `derivePeriodStatus` in `packages/shared-model/src/period-calculator.ts` — status computation
- `formatTotal` in `apps/mobile/src/utils/activityHistory.ts` — number formatting

## Verification

1. Run unit tests: `cd apps/mobile && npx jest scorecardSummary --no-coverage`
2. Run related tests: `cd apps/mobile && npx jest mergeActivityHistoryRows filterActivityRows --no-coverage`
3. Manual check: open scorecard summary, verify Ab Wheel shows 2 periods (not 4)
4. Manual check: verify completion rates across all activities look correct
5. Manual check: tap into detail view, verify stats panel matches summary counts
