# Issue: Scorecard Summary shows fewer completed periods than Scorecard Detail

**Status:** Active
**Opened:** 2026-02-28
**Resolved:** _pending_

## Info
- **Symptom:** For the same activity and time range ("All"), the Scorecard Summary card shows "6/6" under Periods while the Scorecard Detail screen shows 9 period cards. The user expects both to show 9 total periods.
- **Display format:** Summary card shows `metCount/completedCount` (line 51 of `ActivitySummaryCard.tsx`) under "Periods" label. "6/6" means 6 met out of 6 completed.
- **User context:** The activity has "I think just one" standard, the activity name was changed multiple times (in-place update, same activityId). Time range is "All". No visible "(In Progress)" labels on the detail's 9 period cards.
- **Affected area:**
  - `apps/mobile/src/hooks/useScorecardSummary.ts` — Summary data pipeline
  - `apps/mobile/src/screens/ActivityHistoryScreen.tsx` — Detail data pipeline
  - `apps/mobile/src/utils/activityHistory.ts` — `mergeActivityHistoryRows`, `computeSyntheticCurrentRows`
  - `apps/mobile/src/utils/scorecardSummary.ts` — `buildActivitySummaryCards`
  - `apps/mobile/src/hooks/useActivityHistory.ts` — Detail screen Firestore hook

### What both screens share
- Same Firestore query: `listenActivityHistoryForActivity` (no limit, queries by `activityId`, ordered by `referenceTimestampMs desc`)
- Same `mergeActivityHistoryRows()` for dedup/sort
- Same `scorecardTimeRange` from `useUIPreferencesStore`
- Identical counting logic: `status !== 'In Progress'` for completedCount

### Pipeline differences (full trace)

| Stage | Summary (`useScorecardSummary`) | Detail (`ActivityHistoryScreen`) |
|-------|------|--------|
| Firestore subscription | One per relevant activityId (line 82) | Single via `useActivityHistory(selectedActivityId)` (line 120) |
| Synthetic rows | **`syntheticRows: []`** (line 116) — NO current period | Computed from `computeSyntheticCurrentRows` for active standards (line 168-175) |
| StandardId filter | **NONE** — all rows pass through | Filters by `relevantStandardIds` after merge (line 196-197) |
| `nowMs` | `Date.now()` inside `useMemo` — **only refreshes when deps change** (line 134) | `useState(() => Date.now())` — **refreshed every 60s + on app foreground** (line 72, 88-103) |
| Time range filter | `row.periodStartMs < nowMs && row.periodEndMs >= rangeStartMs` (line 147-148) | Same condition (line 232) |
| Clipping | None | `clippedRows` filters out entries where `overlapEnd <= overlapStart` (line 297) |
| Stats source | `buildActivitySummaryCards` inline loop: `status !== 'In Progress'` (scorecardSummary.ts:65) | `clippedRows.filter(entry => entry.row.status !== 'In Progress').length` (line 336) |
| Card rendering | N/A (one summary card per activity) | `filteredRowsForList.map(...)` renders individual period cards (line 598) |

### Key detail: "(In Progress)" label visibility
In the detail, the period card label only shows "(In Progress)" when `row.isCurrentPeriod === true` (line 615). **Persisted rows always have `isCurrentPeriod: false`** (set at merge line 151), so a persisted row with `status: 'In Progress'` would render WITHOUT the "(In Progress)" label. The user's observation of "no (In Progress) labels" does NOT rule out rows with `status: 'In Progress'` in the underlying data.

### Standard count uncertainty
User said "I think just one" standard. `useStandards()` queries `where('deletedAt', '==', null)` — excludes soft-deleted standards. There could be archived standards the user isn't counting. The detail's `relevantStandards` includes ALL non-deleted standards for the activity (active + archived), while the summary's `relevantActivityIds` only includes activities that have at least one active standard (when `showInactiveStandards` is false).

## Experiments

### H1: Synthetic current-period rows inflate detail's completedCount
- **Rationale:** The detail generates synthetic rows for each active standard. If `derivePeriodStatus` returns `'Met'` (because `total >= minimum`), these rows are counted in `completedCount`.
- **Experiment:** Check whether `9 - 6 = 3` matches the number of active standards. If the activity has 3 standards and all meet their minimum this period, this adds 3 to the detail's count.
- **Result:** User says "I think just one" standard. With 1 standard, max extra = 1 synthetic row. Cannot explain a gap of 3. Also, both screens show their own stats — the summary's `metCount/completedCount` is 6/6, and the detail renders 9 cards. Even if synthetic rows add to the detail's count, it only adds to the STATS, not to the CARD count. The 9 cards come from `filteredRowsForList`, which includes both persisted and synthetic.
- **Verdict:** **Insufficient alone.** Could contribute +1 at most (with 1 standard). Cannot explain +3. Need runtime data to verify actual standard count.

### H2: Stale `nowMs` in summary excludes recent periods
- **Rationale:** Summary's `nowMs` is captured inside `useMemo` with no time dependency.
- **Experiment:** Time range is "All", which bypasses the time filter entirely (`if (scorecardTimeRange === 'All') filtered = rows`). So `nowMs` staleness has ZERO effect on this case.
- **Result:** Irrelevant for time range "All".
- **Verdict:** **Ruled out for this case.** Still a latent bug but not contributing here.

### H3: StandardId filter on detail REDUCES count (wrong direction)
- **Rationale:** Detail filters `merged.filter(row => allowed.has(row.standardId))`. Summary has no standardId filter.
- **Experiment:** This filter can only remove rows, not add them. Would make detail show FEWER rows.
- **Result:** Wrong direction.
- **Verdict:** **Ruled out.** Cannot cause summary < detail.

### H4: Dedup collision differences between pipelines
- **Rationale:** Presence/absence of synthetic rows changes which persisted rows survive dedup.
- **Experiment:** Analyzed all collision scenarios. Synthetic rows can only REPLACE persisted rows (claiming the same key), never ADD new unique keys. Net row count doesn't increase.
- **Result:** Wrong direction — can only reduce detail rows.
- **Verdict:** **Ruled out.** Cannot cause summary < detail.

### H5: Persisted rows with `status: 'In Progress'` are invisible in display but excluded from count
- **Rationale:** The summary shows `metCount/completedCount` (6/6). If there are 9 total merged rows but 3 have `status: 'In Progress'`, then `completedCount = 6` and display shows 6/6. The detail renders ALL rows as cards (9 cards) including those with In Progress status. The "(In Progress)" label is only shown when `isCurrentPeriod === true`, which is NEVER true for persisted rows (always set to `false` at merge line 151). So the user would see 9 unlabeled cards in detail and "6/6" in summary.
- **Experiment:** Need runtime data. If `[SUMMARY-DIAG] card for <activityId>: totalRows=9 completedCount=6 inProgressCount=3` appears, this confirms the hypothesis. The discrepancy is not about different row counts — it's about the summary's display format only showing completed/met counts while the detail shows all periods as cards.
- **Result:** _pending runtime data_
- **Verdict:** _pending_

### H6: Both pipelines have different row counts due to dedup collisions in merge
- **Rationale:** `recalculateHistoricalBoundaries` might map multiple Firestore docs to the same dedup key (`${standardId}__${recalculatedStartMs}`), dropping rows. If the collision count differs between pipelines (due to synthetic rows changing which keys are "first seen"), the counts diverge.
- **Experiment:** Analyzed all collision scenarios — synthetic rows don't prevent persisted collisions, they just claim the key first. The number of unique keys is the same or fewer with synthetic rows. Cannot increase detail count.
- **Result:** Static analysis shows this can't increase detail count. But could the SUMMARY have more collisions than the detail? Only if the detail's synthetic row prevents a collision that would otherwise occur. Scenario: two persisted rows map to key K. Synthetic row also maps to key K. In summary: 1 of 2 survives (1 unique key). In detail: synthetic claims K, both persisted rows are dropped (still 1 unique key). Same count. No difference.
- **Verdict:** **Ruled out.** Mathematically cannot cause different unique key counts.

### H7: Different Firestore snapshot timing between subscriptions
- **Rationale:** Summary and detail use separate Firestore `onSnapshot` subscriptions. If new docs are written between when the summary subscription fires and when the detail subscription fires, they'd see different doc counts.
- **Experiment:** This would be a transient timing issue, not a persistent 3-row gap. Would resolve on next snapshot.
- **Result:** Unlikely to explain a consistent 3-row gap. But worth confirming with diagnostic logs.
- **Verdict:** **Unlikely.** Would be transient, not persistent.

## Current diagnostic logging

Enhanced logging has been added to both pipelines (to be removed after diagnosis):

**Summary** (`useScorecardSummary.ts`):
- Logs every persisted doc ID and referenceTimestampMs
- Logs every merged key with status
- Logs dedup drops count
- `buildActivitySummaryCards` logs totalRows, completedCount, metCount, inProgressCount per card

**Detail** (`ActivityHistoryScreen.tsx`):
- Logs every persisted doc ID and referenceTimestampMs
- Logs every merged key with status and SYN/PER indicator
- Logs dedup drops count
- Logs `relevantStandardIds` (count and IDs)
- Logs standardId filter drops (with dropped standardIds)
- Logs `filteredRowsForList` vs `clippedRows` count
- Logs stats result: metCount, completedPeriods, percentMet
- Logs count of In Progress rows if any

### Next steps
1. Reproduce the bug with logging in place
2. Check `[SUMMARY-DIAG]` and `[DETAIL-DIAG]` console output
3. The logs will definitively show:
   - Whether both pipelines get the same number of Firestore docs
   - Whether dedup is dropping rows (and how many)
   - Whether the summary's "6" comes from 6 total rows or 9 total rows with 3 In Progress
   - How many standards the detail sees (`relevantStandardIds`)
   - Whether the standardId filter drops any rows

## Root cause summary
_Pending runtime data. H5 is the leading candidate — the summary may have 9 rows internally but display "6/6" because 3 rows have `status: 'In Progress'`. Needs confirmation._

## Fix requirements
_Pending root cause confirmation._

## Resolution
_Do not fill this section until the fix is verified — either by a passing
test/build or by explicit user confirmation. Applying a fix is not verification._
