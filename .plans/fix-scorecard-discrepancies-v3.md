# Fix Scorecard Summary + Detail Screen Data Discrepancies

## Context

The scorecard has two views: a **summary** (one card per activity) and a **detail** (period history for a single activity). Multiple categories of incorrect data have been reported:

1. **Ab Wheel:** Summary shows ~8 periods and 710 reps. Detail shows only 1 completed period and 140 reps. Chart reflects only 140 reps.
2. **Previous session:** Summary showed 6/6 under Periods while detail showed 9 period cards.
3. **Selling activity:** A period card shows "30 out of 60 minutes" but tapping in reveals only one 10-minute log entry — snapshot data doesn't match log data.
4. **General:** Periods stat denominator should be completed-only (exclude in-progress), currently uses total row count.

The previous plan speculated about orphaned standards as the primary cause. The actual root cause is a **split data model**: persisted `activityHistory` docs are keyed by activityId (includes all standards ever), while `activityLogs` queries are filtered by current standardIds (excludes deleted standards). The detail screen also incorrectly filters period rows by current standardIds, hiding historical data.

## Root Cause Analysis

### The data model split

- **`activityHistory` docs** (Firestore, collection per user): One doc per completed (standardId, period). Queried by `activityId` — returns ALL historical standards.
- **`activityLogs` docs** (Firestore, collection per user): Individual log entries. Queried by `standardId` — only returns logs for the standards you ask about.

### How this creates discrepancies

**Summary pipeline** (`useScorecardSummary.ts`):
- Gets ALL activityHistory docs for the activity (no standardId filter)
- Counts every row as a "period" (`totalPeriods = rows.length`)
- Sums `row.total` across all rows (including old/deleted standards)
- Result: inflated period count and volume

**Detail pipeline** (`ActivityHistoryScreen.tsx`):
- Gets ALL activityHistory docs (same Firestore query)
- **Then filters rows by `relevantStandardIds`** (line 192) — only non-deleted standards from `useStandards()`
- Stats/charts use `rangeLogs` from `useActivityRangeLogs` — also filtered by current standardIds
- Result: historical periods from deleted standards are invisible

**The user's expectation:** Both screens should show ALL historical data for the activity, regardless of which standard generated it. If a standard was deleted and recreated, the old periods should still be visible.

### Specific bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | Summary counts raw rows as periods | `scorecardSummary.ts:78` | Multiple standards per period = inflated count |
| 2 | Detail INCORRECTLY filters rows by current standardIds | `ActivityHistoryScreen.tsx:188-194` | Hides historical periods from deleted standards |
| 3 | Detail stats use `rangeLogs` (log-query) not period data | `ActivityHistoryScreen.tsx:322` | `totalValue` comes from logs query, which excludes deleted-standard logs |
| 4 | `rangeLogs` query only includes current standard IDs | `ActivityHistoryScreen.tsx:160-164` | Historical logs under deleted standards are invisible to stats/charts |
| 5 | `countMetLabel` denominator is `totalPeriods` not `completedCount` | `scorecardSummary.ts:90` | In-progress periods inflate denominator |
| 6 | Period card snapshot data may not match logs | `ActivityHistoryScreen.tsx:607` | Card shows `row.total` (persisted snapshot) but drill-in shows live logs — can diverge if data changed |

## Plan

### Step 1: Remove standardId filter from detail screen period list

**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx` (lines 188-194)

Stop filtering merged rows by `relevantStandardIds`. The detail screen should show ALL period history for the activity, matching the Firestore query scope.

```typescript
// Before:
const mergedRows = useMemo(() => {
  const merged = mergeActivityHistoryRows({ persistedRows, syntheticRows, timezone, nowMs });
  if (relevantStandardIds.length === 0) {
    return merged;
  }
  const allowed = new Set(relevantStandardIds);
  return merged.filter((row) => allowed.has(row.standardId));
}, [...]);

// After:
const mergedRows = useMemo(() => {
  return mergeActivityHistoryRows({ persistedRows, syntheticRows, timezone, nowMs });
}, [persistedRows, syntheticRows, timezone, nowMs]);
```

### Step 2: Fix period counting to use unique time periods

**File:** `apps/mobile/src/utils/scorecardSummary.ts`

Extract a pure, testable `aggregatePeriodStats(rows)` function:

1. Group rows by `periodStartMs` (each unique value = one time period)
2. For each unique period:
   - **Completed** if no row for that period has `status === 'In Progress'`
   - **Met** if all rows for that period have `status === 'Met'`
3. If multiple rows share the same `periodStartMs` (rare — would mean multiple standards active simultaneously), sum their totals (activity-based model)

```typescript
export function aggregatePeriodStats(rows: MergedActivityHistoryRow[]): {
  completedCount: number;  // unique completed periods (excluding in-progress)
  metCount: number;        // unique periods where all rows are Met
  totalVolume: number;     // sum of row.total across all rows
} {
  const byPeriod = new Map<number, MergedActivityHistoryRow[]>();
  for (const row of rows) {
    const group = byPeriod.get(row.periodStartMs) ?? [];
    group.push(row);
    byPeriod.set(row.periodStartMs, group);
  }

  let totalVolume = 0;
  let metCount = 0;
  let completedCount = 0;

  for (const [, group] of byPeriod) {
    const hasInProgress = group.some(r => r.status === 'In Progress');
    const allMet = group.every(r => r.status === 'Met');

    // Sum volume across all rows (even if multiple standards in same period)
    for (const r of group) {
      totalVolume += r.total;
    }

    if (!hasInProgress) {
      completedCount += 1;
      if (allMet) {
        metCount += 1;
      }
    }
  }

  return { completedCount, metCount, totalVolume };
}
```

Replace the inline loop in `buildActivitySummaryCards` (lines 60-78) with a call to `aggregatePeriodStats`.

Update `countMetLabel` to `${metCount}/${completedCount} periods`.

### Step 3: Update ActivitySummaryCard display

**File:** `apps/mobile/src/components/ActivitySummaryCard.tsx`

Change line 51 from `{card.metCount}/{card.totalPeriods}` to `{card.metCount}/{card.completedCount}`.

### Step 4: Fix detail screen stats to use snapshot totals for completed periods

**File:** `apps/mobile/src/screens/ActivityHistoryScreen.tsx`

The stats panel (line 317-348) computes `totalValue` from `rangeLogs` (log-level query filtered by current standardIds). This misses historical volume from deleted standards.

Use `row.total` from persisted snapshots for completed periods. The snapshot was written at boundary time and reflects the true total. Only use live clipped data for the current in-progress period.

```typescript
// Before:
const totalValueRaw = rangeLogs.reduce((sum, log) => sum + log.value, 0);

// After:
const totalValueRaw = clippedRows.reduce((sum, entry) => {
  return sum + (entry.row.isCurrentPeriod ? entry.clippedTotal : entry.row.total);
}, 0);
```

Charts (period progress bars) already use `r.total` from the row (line 371), so those are already correct for persisted periods.

### Step 5: Fix detail stats period counting to deduplicate by time period

Apply the same unique-period logic as Step 2 to the detail stats computation. Currently it counts raw `clippedRows` as periods.

Use `aggregatePeriodStats` (or adapt its logic for clippedRows) in the stats `useMemo` block.

### Step 6: Update and expand tests

**File:** `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts`

Add `describe('aggregatePeriodStats')`:
- Single standard, all Met
- Single standard, mixed Met/Missed/In Progress
- Multi-standard: same periodStartMs → counts as 1 period, volume = sum of both
- Multi-standard: all Met → period is Met; one Missed → period not Met
- Any In Progress → period not counted as completed
- Empty input → all zeros

Update existing `buildActivitySummaryCards` tests:
- Adjust `totalPeriods` and `countMetLabel` expectations for new completed-only counting
- Add test with multi-standard activity verifying dedup

### Step 7: Address selling activity snapshot vs log discrepancy (investigation)

The selling activity shows "30 out of 60" on a period card but only a 10-minute log inside. This suggests the persisted `activityHistory` doc's `total` field was written with stale/incorrect data at boundary time, or logs were edited/deleted after the snapshot was written.

This is a data integrity issue with the snapshot write logic (`writeActivityHistoryPeriod`), not a display bug. After the above fixes are in:
1. Add diagnostic logging when the detail screen detects that `row.total` doesn't match the sum of logs in `periodLogsMap` for that period
2. Investigate whether the boundary engine correctly sums logs at snapshot time

## Files to Modify

| File | Change |
|------|--------|
| `apps/mobile/src/utils/scorecardSummary.ts` | Extract `aggregatePeriodStats`, use it in `buildActivitySummaryCards` |
| `apps/mobile/src/hooks/useScorecardSummary.ts` | No changes needed (keep as-is, no standardId filter) |
| `apps/mobile/src/components/ActivitySummaryCard.tsx` | Display `metCount/completedCount` |
| `apps/mobile/src/screens/ActivityHistoryScreen.tsx` | Remove standardId filter on merged rows; fix stats to use snapshot totals; deduplicate period counting |
| `apps/mobile/src/utils/__tests__/scorecardSummary.test.ts` | Add `aggregatePeriodStats` tests, update existing assertions |

## Key Functions to Reuse

- `mergeActivityHistoryRows` in `apps/mobile/src/utils/activityHistory.ts`
- `derivePeriodStatus` in `packages/shared-model/src/period-calculator.ts`
- `formatTotal` in `apps/mobile/src/utils/activityHistory.ts`

## Verification

1. `cd apps/mobile && npx jest scorecardSummary --no-coverage`
2. `cd apps/mobile && npx jest mergeActivityHistoryRows filterActivityRows --no-coverage`
3. Manual: Ab Wheel summary and detail should show same period count and volume
4. Manual: Periods stat denominator excludes in-progress periods
5. Manual: Detail shows all historical periods including those from old/deleted standards
6. Manual: Charts reflect full historical data
