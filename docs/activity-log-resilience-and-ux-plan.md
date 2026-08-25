# Activity Log Resilience and UX Plan

**Status:** Revised — ready for engineering review; durable history ownership is gated
by the ADR described below

**Date:** 2026-08-25

**Revision:** 2

**Implementation status (2026-08-25):** WP1-WP3 are implemented in the mobile client,
including the one-shot service boundary, status-only operation store, Firestore metadata
decoration, immediate modal close, failed-sync actions, and auth recovery gate. The
client-side history call is isolated behind a reconciliation service and runs only after
primary acknowledgement. WP4's durable backend owner/repair mechanism and WP5's
production telemetry rollout remain intentionally unimplemented pending the ADR and
release/device validation gates below.

## Product Goal

Make logging progress feel immediate and remain trustworthy through slow networks,
offline use, and temporary authentication recovery. A valid log should never appear
to fail because a secondary history calculation failed.

The target interaction is:

1. The user taps **Save**.
2. Stable authentication is verified and one create attempt is handed to the Firestore
   SDK without awaiting remote acknowledgement.
3. The modal closes immediately; Firestore's latency-compensated local listener reflects
   the pending entry without waiting for the backend.
4. A non-blocking confirmation offers **Undo**.
5. Firestore acknowledgement and history reconciliation continue in the background.
6. If synchronization needs attention, the entry moves to a clear pending or failed
   state without being misrepresented as confirmed progress.

## Current Evidence

The current log-entry path has two avoidable sources of perceived latency:

- `LogEntryModal` keeps its `saving` state active while awaiting the Firestore write.
- On iOS, it deliberately waits another 900 ms after the write succeeds before closing.

The primary `activityLogs` write is followed by a client-side activity-history
recomputation. That recomputation is fire-and-forget, but it performs additional reads
and a derived write that can independently produce an error.

The current authentication listener also has a transient recovery window. When Firebase
reports no user, the listener awaits silent Google sign-in before updating the app's
stored user state. During that interval, authenticated UI and callbacks holding the
previous UID can remain available even though Firestore has no matching authenticated
request. The owner-only rules correctly reject a write in that state.

Production rules matched the repository rules when checked on 2026-08-25. Successful
primary-log and activity-history writes were present for the reported period. This makes
a deterministic rules or numeric-value defect less likely. A transient authentication
race remains a hypothesis, not a confirmed root cause.

There is not enough durable telemetry to reconstruct the exact failed operation. Caught
log and history errors are currently displayed or printed to the console without an
operation identifier, timing information, or non-fatal error record.

## Goals

- Invoke the Firestore attempt and modal close within 150 ms of a valid Save tap,
  independent of remote acknowledgement latency. Native dismissal animation and local
  listener latency are measured separately.
- Reflect the new value through Firestore's local listener without waiting for a server
  acknowledgement.
- Preserve pending writes through ordinary offline/reconnection behavior.
- Prevent duplicate logs when an operation is retried.
- Prevent writes during transient authentication recovery.
- Distinguish retryable connectivity/authentication failures from permanent validation
  or authorization failures.
- Keep primary log success independent from derived history success.
- Provide enough structured telemetry to diagnose future latency and permission reports.
- Keep business logic, UI state, and Firebase I/O independently testable.

## Non-Goals

- Redesigning the log-entry form or stopwatch.
- Changing standard cadence, quantity, or unit semantics.
- Relaxing owner-only Firestore access.
- Replacing Firestore offline persistence with a second general-purpose local database.
- Persisting activity-log mutation envelopes in AsyncStorage.
- Making activity-history reconciliation block the logging interaction.

## Product Decisions

### Optimistic completion

The modal closes after stable-auth validation and after the single write attempt has been
handed to Firestore. It does not await remote acknowledgement and does not contain a fixed
success delay. Firestore's latency-compensated local snapshot, rather than a second app
data row, provides optimistic progress.

A snackbar or toast confirms the exact action, for example:

> 0.5 hours logged

The confirmation includes **Undo** and remains available for the existing undo duration.
Pending synchronization is communicated outside the modal.

### Visible synchronization state

An optimistic log has one of four local states:

| State | User experience | Allowed action |
|---|---|---|
| `pending` | Value is included; subtle sync indicator | Undo |
| `synced` | Normal entry | Undo/edit/delete |
| `failed-retryable` | Removed from confirmed totals and shown in a failed-sync tray | Retry, edit, or discard |
| `failed-permanent` | Removed from confirmed totals and shown with a support reference | Review, edit, or discard |

The dashboard should avoid a full-screen or modal loading state for log synchronization.
A screen-level sync banner is appropriate only when multiple mutations are pending or
the device is offline for a meaningful duration.

### Safe mutation identity and ordering

Generate the Firestore log document ID before starting the write. That deterministic ID
prevents a retry from creating a second document, but it does **not** make blind `set`
replay safe. The current create payload uses `serverTimestamp()` for `createdAt`, and the
update rules require `createdAt` to remain stable. Replaying a create after an ambiguous
success can therefore fail validation or overwrite a newer edit.

Use this protocol:

1. Prepare one random Firestore document ID and one local `operationId`.
2. Register operation metadata in memory.
3. Submit the initial create exactly once and retain that attempt's promise/state;
   Firestore's local listener supplies the provisional data row.
4. Never issue a second create while the first attempt is pending in Firestore.
5. On an ambiguous failure, perform a server reconciliation read for that document ID:
   - matching document exists -> mark synced;
   - document is confirmed absent -> a new create attempt may be issued;
   - document exists with conflicting content -> stop and surface a conflict;
   - server state is unavailable -> remain pending; do not guess.
6. Once an edit, delete, restore, or undo is requested for the same log, serialize it
   behind the create outcome. A stale create completion or retry may not overwrite it.

“Matching” compares the canonical prepared business fields (`standardId`, `value`,
`occurredAt`, normalized `note`, and initial deletion/edit state). It deliberately ignores
server-generated timestamps. Confirmed absence requires a server-source response while
stable authentication and network connectivity are available; a cache miss is unknown,
not absent.

Every asynchronous result carries an `attemptId` and per-document sequence number. The
store ignores results from superseded attempts. Updates preserve the original `createdAt`
and mutate only fields allowed by the update rules.

### Authentication-aware submission gating

Authentication becomes an explicit state machine:

- `initializing`
- `authenticated`
- `recovering`
- `signing-out`
- `unauthenticated`

Authentication recovery is allowed only for an unplanned loss of the current session and
only when the recovered Firebase UID equals the previous UID. Private screens are covered
by a reconnecting state while identity is uncertain. New mutations are not accepted or
held in a volatile app-only queue; any open form draft remains intact until authentication
is stable and the user can submit again.

Explicit sign-out and account switching are different flows. They immediately remove
private UI state, disable silent recovery for that transition, discard app-level pending
mutation state for the departing UID, and must never flush it under a later account.

If unplanned recovery fails or produces a different UID, the app transitions to
`unauthenticated`, clears the previous account's UI state, and does not expose its pending
mutation contents. Cross-account mutation migration is forbidden.

### Derived history is secondary

Creating or editing an activity log is the primary operation. Activity-history records
are derived data and must not determine whether the user sees the log as successful.

Current-period optimistic progress is computed only in the client view model. Persisted
activity history is recomputed only after the primary log is server-acknowledged or by a
backend process observing canonical data. A locally queued or permanently rejected log
must never be written into persisted history.

The current client recomputation may remain temporarily behind a separate reconciliation
service, but durable history ownership requires an approved ADR before WP4 begins.

## Safety Invariants

Implementation and review should reject any design that violates these invariants:

1. **No blind create replay.** An ambiguous create is reconciled by document ID before
   another create is attempted.
2. **One ordered mutation stream per log ID.** Create, edit, undo, soft-delete, and
   restore cannot race or overwrite newer intent.
3. **No cross-account access or flushing.** Mutation and UI state are partitioned by UID;
   explicit sign-out clears the departing account's app-level state.
4. **One effective representation per log ID.** Firestore's listener row—including its
   local pending state—is the only activity-log row used by lists and totals. The
   operation store never contributes a duplicate data row.
5. **Pending is provisional; failed is not progress.** Pending values may contribute to
   an explicitly optimistic total. Permanently failed values do not contribute to
   confirmed totals.
6. **Persisted history uses canonical data.** History never incorporates a merely queued
   local pending write.
7. **Secondary failure cannot reverse primary success.** History, telemetry, toast, or
   listener failures cannot turn an acknowledged log into a failed log.
8. **Firestore is the only durable offline mutation queue in this scope.** No activity
   notes or mutation envelopes are added to unencrypted AsyncStorage.

## Proposed Mobile Architecture

### Service layer

Add `apps/mobile/src/services/activityLogsService.ts` as the only mobile module that
creates, updates, soft-deletes, or restores activity-log Firestore documents.

Suggested interface:

```ts
export type ActivityLogWrite = {
  id: string;
  userId: string;
  standardId: string;
  value: number;
  occurredAtMs: number;
  note: string | null;
};

export interface ActivityLogsService {
  createOnce(input: ActivityLogWrite): Promise<void>;
  getFromServer(input: {
    userId: string;
    logEntryId: string;
  }): Promise<ActivityLogWrite | null>;
  update(input: ActivityLogWrite): Promise<void>;
  softDelete(input: { userId: string; logEntryId: string }): Promise<void>;
  restore(input: { userId: string; logEntryId: string }): Promise<void>;
}
```

`createOnce` means one submission attempt, not “retry until success.” Retry and
reconciliation policy belongs in the mutation controller. `getFromServer` must not treat
a cache miss as confirmed absence.

The service accepts Firebase bindings through one centralized dependency boundary so
tests can substitute deterministic fakes. It verifies the current Firebase UID at the
moment of I/O, preserves immutable creation fields, and normalizes native Firebase errors
before returning them to hooks or stores.

Remove direct activity-log writes from `useStandards`. Standards and activity logs are
separate responsibilities and should not share one mutation hook.

### Pure mutation logic

Add pure utilities in `apps/mobile/src/utils/activityLogMutations.ts`:

- `prepareActivityLogMutation(input, ids, nowMs)`
- `classifyActivityLogError(error, authState)`
- `decorateActivityLogsWithOperationStatus(listenerLogs, operations)`
- `reduceActivityLogMutation(state, event)`
- `buildActivityLogRetryDecision(mutation, error, attempt)`
- `resolveCreateReconciliation(expected, serverDocument)`
- `buildAffectedHistoryPeriods(before, after, standardConfig)`

These functions contain validation, deduplication, state transitions, and retry policy.
They do not import Firebase, React, Zustand, or React Native.

### Operation store

Add a focused Zustand store in `apps/mobile/src/stores/activityLogOperationStore.ts`.
It owns attempt ordering, acknowledgement/error status, failed payloads needed for
Retry/Edit, and undo intent. It does not own or render a second optimistic activity-log
collection.

Suggested actions:

- `register(operation)`
- `markAttempting(operationId, attemptId, sequence)`
- `markPending(operationId, attemptId)`
- `markSynced(operationId, attemptId)`
- `markFailed(operationId, attemptId, error)`
- `retry(operationId)`
- `discard(operationId)`
- `requestUndo(operationId)`
- `resumeForAuthenticatedUser(userId)`

The store must scope operations to the originating UID and serialize operations per log
document ID. Reducer events with an obsolete `attemptId` or sequence are ignored. Pending
or failed operations from one UID must never display or resume after another account
signs in.

Firestore remains responsible for durable offline write queuing. The store provides
operation control and error state. Firestore listener metadata and document identity
reconcile locally queued writes. Failed payloads exist only in memory for this scope and
are cleared on explicit sign-out or process termination.

AsyncStorage persistence is explicitly out of scope. If restart testing demonstrates a
gap that Firestore cannot cover, stop and write a separate security-reviewed design for
encrypted persistence, retention, sign-out deletion, and account isolation.

Accepted initial limitation: a definitively failed payload in the failed-sync tray is
recoverable only while the process remains alive. Firestore-pending writes remain durable,
but a rejected payload is cleared on process termination or explicit sign-out. Product QA
must verify the failure message makes Retry/Edit/Discard immediately actionable. Durable
failed-draft recovery requires the separate encrypted-persistence design above.

### Mutation hook

Add `apps/mobile/src/hooks/useActivityLogMutation.ts` to coordinate:

- Pure input preparation.
- Current auth-state validation.
- Single-attempt service invocation and attempt tracking.
- Observation of the Firestore local listener row without awaiting remote acknowledgement.
- Server reconciliation before any create replay.
- Per-document mutation serialization.
- Retry classification.
- Background history reconciliation.
- Analytics and non-fatal error reporting.

Screens and modals consume this hook. They do not call Firestore or the service directly.

### Read reconciliation

Existing activity-log listeners—including their latency-compensated local view—are the
only data source for activity-log lists and totals. Add one shared pure decorator that
joins operation status to listener rows by document ID without adding, replacing, or
duplicating data rows.

Every consumer of activity logs or totals must preserve that single-source rule,
including dashboard progress, period details, scorecards, quick log,
edit/delete/restore surfaces, and activity-history views that show current-period data.

Reconciliation rules are explicit:

1. A Firestore listener row contributes exactly once to lists, session counts, and totals.
2. Listener metadata determines local-pending versus server-acknowledged when available.
3. The operation store may decorate a row with pending/undo status. An explicit newer
   undo intent may suppress that row from effective views immediately, but the store
   never supplies a competing value, timestamp, deletion state, or note.
4. A rejected Firestore write rolls back from the listener view. Its in-memory failed
   operation is shown only in the failed-sync tray and is excluded from totals.
5. Retry submits the failed payload through the normal single-attempt protocol; it does
   not add a data row before Firestore emits one.

WP1 includes a time-boxed compatibility test for local listener latency, metadata changes,
and `hasPendingWrites` in the installed React Native Firebase SDK. If supported, metadata
is the preferred acknowledgement signal. Otherwise the retained write promise marks
acknowledgement while the listener remains the single data source. If Firestore does not
emit the local row quickly and consistently on either platform, stop and write a separate
ADR before introducing any app-level optimistic data overlay.

## Authentication Design

Update `authStore` so Firebase and UI state cannot disagree silently during recovery.

Required behavior:

1. The store tracks `authenticatedUid`, `recoveryUid`, and whether sign-out was explicit.
2. An unexpected `onAuthStateChanged(null)` immediately sets `status: 'recovering'` and
   `recoveryUid` to the prior UID before awaiting silent sign-in.
3. Private screens are covered by a reconnecting surface while identity is uncertain.
4. Silent recovery succeeds only if the restored Firebase UID equals `recoveryUid`.
5. Same-UID recovery atomically installs the user and sets `status: 'authenticated'`.
   Mutations already handed to Firestore may resume observation/reconciliation; no new
   unsent mutation is flushed from volatile app memory.
6. Failed or different-UID recovery clears private UI/mutation state and sets
   `status: 'unauthenticated'`. It does not show the old account's mutation contents on
   the sign-in screen.
7. Explicit sign-out first sets `status: 'signing-out'`, disables silent recovery, clears
   app-level private and operation state, and then signs out of Firebase/Google.
8. Account switching completes the sign-out cleanup before the next account is installed.
9. Mutation services read the current Firebase user at invocation time and verify that
   its UID equals both the reactive store UID and the mutation's `userId`.
10. A Save action encountered during `initializing`, `recovering`, or `signing-out` keeps
    its form draft open and is not represented as accepted, optimistic, or sent to
    Firestore.

Do not use `firebaseAuth.currentUser?.uid` as an independently captured source of truth
inside every hook. Hooks should consume the reactive auth store, while the service makes
a final current-user assertion at the I/O boundary.

This work does not promise cancellation of writes already accepted into Firestore's
native offline queue. Explicit sign-out removes their app-level representation and never
replays them under another UID. Document and test the installed SDK's behavior for native
pending writes across sign-out before release; if it can expose cross-account data, the
release is blocked pending a cache/persistence mitigation.

## Retry and Error Policy

Normalize errors at the service boundary into stable categories:

| Category | Examples | Policy |
|---|---|---|
| Transient before submission | unavailable detected before `createOnce` | Exponential retry with jitter |
| Ambiguous after submission | timeout, disconnect, unknown acknowledgement | Reconcile by document ID; no blind replay |
| Auth recoverable | unauthenticated, UID mismatch during recovery | Preserve draft or pending state; resume only after same-UID recovery |
| Permission permanent | permission denied with stable matching auth | No automatic loop; surface diagnostic action |
| Validation permanent | invalid argument, out of range | Do not retry; preserve editable input |
| Unknown after submission | unclassified native error | Reconcile first; never conservatively replay a create |

Retries reuse the same document ID only after the prior attempt is no longer pending and
a server read confirms the document is absent. Cap automatic attempts and reset the
attempt budget only after a meaningful state change such as network restoration or
same-UID authentication recovery.

The existing retry utility should be updated or replaced for this path because native
Firebase errors must be normalized before retry classification. A wrapper that only
recognizes an application-specific `FirestoreError` will not reliably classify raw SDK
errors.

## Activity-History Reconciliation

### Phase-one behavior

- Keep current-period dashboard progress driven directly from activity logs.
- Move recomputation calls out of `useStandards` into an
  `activityHistoryReconciliationService`.
- Trigger persisted reconciliation only after the primary activity-log write is
  server-acknowledged. Locally pending progress remains a view-model concern.
- Never await reconciliation before closing the modal or marking the log visible.
- Record reconciliation failures separately from log failures.
- Preserve current history behavior for create, edit, soft-delete, restore, and standard
  configuration changes until the durable model replaces it.
- For edits that move `occurredAt` or change the applicable cadence boundary, reconcile
  both the old and new affected periods. Delete/restore reconciles the original period.
- Do not add indefinite client reconciliation retries that can outlive the owning UID.

### Durable follow-up

WP4 is blocked on an Architecture Decision Record that chooses one durable ownership
model:

1. A Firestore-triggered backend function recomputes the affected deterministic history
   document after activity-log changes; or
2. An idempotent callable recomputation endpoint plus a periodic repair/reconciliation
   pass.

The first option provides stronger automatic consistency but introduces a new trigger
pattern to a codebase whose current functions are callable. The second preserves the
existing callable architecture but requires an explicit repair strategy. This decision
does not block WP1-WP3, but no durable history migration is implemented or partially
rolled out without it.

Whichever model is selected must:

- Use the Admin SDK for history writes.
- Recompute from canonical activity logs rather than applying fragile increments.
- Use deterministic history document IDs.
- Be safe to invoke more than once.
- Handle at-least-once delivery and out-of-order completion without allowing an older
  computation to overwrite a newer one.
- Reconcile every affected period for create, timestamp-moving edit, delete, restore, and
  standard cadence/configuration changes.
- Repair missed or stale history documents.
- Keep history errors separate from primary log errors.

## UX Details

### Save

- Validate the numeric value and required standard state synchronously.
- Require stable `authenticated` state before accepting the mutation. If auth is
  recovering, preserve the draft and show the reconnecting state instead of closing.
- Prepare the mutation and invoke `createOnce` exactly once without awaiting its remote
  acknowledgement.
- Register the pending operation state immediately after invocation; do not add a second
  activity-log data row.
- Close the modal immediately.
- Announce success through a toast/snackbar and accessibility announcement.
- Do not render the existing Save-button spinner after the modal begins closing.
- Remove the hard-coded 900 ms success delay.

### Pending

- Include pending values in the current dashboard total.
- Mark individual pending entries subtly in activity-log detail views.
- After two seconds, a pending entry may change from an animated indicator to a static
  “Waiting to sync” state so the UI does not look stuck.
- Show a broader offline/sync banner only when useful; avoid repeated alerts per entry.

### Failure

- Retryable: “Not synced yet. Tap to retry.”
- Auth recovery: “Reconnecting to your account…” without discarding the entry.
- Permanent permission error: “This entry could not be saved. Review account access or
  discard it.” Include a supportable error/reference ID.
- Failed entries are removed from effective totals and shown in a dedicated failed-sync
  tray. Retry returns them to a visibly pending state; discard removes them.
- Never present a history-reconciliation failure as “Failed to save log entry.”

### Undo

- Undo suppresses the local pending listener row from effective views immediately.
- If the create has not been submitted to Firestore, cancel it locally.
- If the create is pending in Firestore, record newer undo intent and wait for the create
  outcome. On acknowledgement, issue a serialized soft-delete; on confirmed create
  failure, discard both operations.
- If the create is already acknowledged, issue a normal serialized soft-delete.
- Undo remains idempotent and cannot create a second entry.

## Observability

Add structured instrumentation without names, email addresses, notes, or entered values.

Recommended fields:

- `operation_id`
- `operation_type`
- `standard_id`
- `auth_status_at_submit`
- `auth_status_at_attempt`
- `attempt_number`
- `registered_at_ms`
- `write_started_at_ms`
- `write_acknowledged_at_ms`
- `latency_ms`
- `normalized_error_code`
- `retry_decision`
- `history_reconciliation_status`

Record unexpected or terminal failures as Crashlytics non-fatal errors with the same
operation ID. Routine offline pending state should be analytics/debug telemetry, not an
error.

Per-operation IDs are diagnostic correlation values, not analytics dimensions. The
central reporter must prevent Crashlytics attributes from leaking from one operation into
later unrelated reports; do not leave per-operation values in long-lived global keys.

Add development logging behind a centralized logger so production logs do not expose
UIDs or user-entered notes.

## Implementation Work Packages

### WP1 — Service and error boundary

- Add `activityLogsService` with injected Firebase dependencies.
- Move create/update/delete/restore Firestore I/O out of `useStandards`.
- Normalize raw Firebase errors in the service.
- Add deterministic ID, single-attempt create, server reconciliation read, and pure
  retry-classification utilities.
- Verify listener metadata/`hasPendingWrites` and sign-out behavior with the installed SDK
  on iOS and Android.
- Preserve current blocking UX during this package to limit behavioral change.

**Exit criteria:** Existing log flows pass through the service and retain current
behavior; service and pure logic have unit tests; acknowledgement and sign-out behavior
are documented from device tests.

### WP2 — Firestore-native optimistic UX and operation state

- Add the operation reducer/store and status-decorator logic.
- Add `useActivityLogMutation`.
- Route operation-state presentation through the shared listener-row decorator without
  changing the listener data used by totals.
- Update `LogEntryModal`, dashboard logging, quick log, editing, delete, restore, and undo
  to use the new hook.
- Close the modal immediately and remove the 900 ms delay.
- Add pending, failed, retry, and undo presentation.
- Serialize all operations per log ID and reconcile before create replay.

**Exit criteria:** Slow or offline Firestore does not keep the modal open; Firestore emits
one local pending entry; the operation store never adds a second data row; and the user
can undo or retry without stale operations overwriting newer intent.

### WP3 — Authentication recovery gate

- Add explicit auth status to `authStore`.
- Distinguish same-UID recovery, explicit sign-out, and account switching.
- Transition to `recovering` before awaiting silent sign-in and cover private screens.
- Gate new submissions while auth is not stable and preserve any open draft.
- Verify UID at the service boundary.
- Resume observation/reconciliation only for mutations belonging to the authenticated
  UID.
- Clear app-level private/mutation state on explicit sign-out or different-UID recovery.

**Exit criteria:** A simulated auth-null/silent-recovery window cannot issue a Firestore
write with stale credentials; explicit sign-out exposes no prior-account mutation state;
and account switching cannot display or flush the previous UID's mutations.

### WP4 — History isolation and repair

- Write and approve the durable history ownership ADR before implementation.
- Introduce the reconciliation service.
- Remove history responsibility from `useStandards`.
- Implement the selected backend ownership model without a partial dual-writer period.
- Reconcile old and new periods for timestamp/configuration changes.
- Prevent out-of-order recomputations from overwriting newer derived state.
- Add repair behavior for stale history.

**Exit criteria:** A forced history failure leaves the primary log synced and visible;
later reconciliation repairs the history document.

### WP5 — Telemetry, rollout, and cleanup

- Add operation timings and normalized non-fatal reporting.
- Remove obsolete event/retry paths and direct Firestore mutations.
- Roll out incrementally and compare latency/error metrics.
- Document support diagnostics using operation IDs.

**Exit criteria:** A future permission or slow-write report can be traced to an operation,
auth state, normalized error, retry decision, and history outcome.

## Test Plan

### Pure unit tests

- Preparing create, edit, delete, restore, quick-log, and undo mutations.
- Deterministic document identity without blind `set` replay.
- Server reconciliation outcomes: matching, absent, conflicting, and unavailable.
- Per-document sequencing ignores stale attempt completions.
- Mutation reducer transitions:
  - registered -> attempting -> pending -> synced
  - pending -> failed-retryable -> attempting -> synced
  - pending -> failed-permanent
  - pending -> undone
- Decorating listener rows with operation state without changing values or double totals.
- Retry classification for every normalized error category.
- Rejecting an operation when the authenticated UID differs.

### Service tests

- Correct user-scoped Firestore paths and payloads.
- Raw Firebase errors are normalized.
- `createOnce` does not self-retry.
- Server reconciliation does not use cache absence as confirmed absence.
- Updates preserve immutable `createdAt`.
- Soft-delete and restore remain idempotent.
- Service refuses missing, recovering, or mismatched auth state.

### Hook/store tests

- Firestore's local listener emits the pending entry before the service promise resolves.
- Successful acknowledgement reconciles the pending entry.
- Offline writes stay pending without blocking the caller.
- Ambiguous create failure reconciles before exposing or executing Retry.
- Retryable failure exposes Retry and respects the attempt cap.
- Create followed quickly by edit or undo remains ordered.
- Listener local echo contributes exactly once; operation state contributes no data row.
- Auth recovery preserves an unsubmitted form draft and does not create a volatile queued
  mutation.
- Signing into another UID does not flush the previous user's mutation.
- Explicit sign-out clears private and operation app state.
- History failure does not change the primary mutation to failed.

### Screen/component tests

- Save closes the modal without awaiting Firestore.
- No fixed 900 ms delay remains.
- Pending and failed indicators render with accessible labels.
- Undo removes the local pending listener entry and invokes soft-delete when required.
- Quick-log uses the same mutation pipeline.

### Firestore emulator tests

- Owner can create valid integer and decimal activity logs.
- Unauthenticated and wrong-owner writes fail.
- Archived-standard creation fails.
- Update, soft-delete, and restore payloads satisfy the rules.
- Replaying a create with a new server `createdAt` is demonstrated to be unsafe under the
  current update rules, preventing regression to blind replay.
- Reconciliation-by-ID distinguishes an existing acknowledged document from absence.

### Integration scenarios

- Slow network acknowledgement.
- Device offline at Save, followed by reconnection.
- App background/foreground while a mutation is pending.
- Listener emits a local pending document before write acknowledgement.
- User edits or undoes a create before acknowledgement.
- Firebase user temporarily becomes null and silent sign-in succeeds.
- Silent sign-in fails.
- Explicit sign-out while a native Firestore write is pending.
- Account A signs out and account B signs in.
- App is reopened with a Firestore-local pending write.
- Primary log succeeds while history reconciliation fails.

## Rollout and Safety

1. Land the service boundary and SDK behavior tests without changing UX.
2. Land the listener-row status decorator while preserving blocking writes; verify totals
   do not change.
3. Enable optimistic handling for manual create only behind a release flag.
4. Enable explicit auth recovery/sign-out gating before broadening optimistic writes.
5. Extend the shared serialized pipeline to quick log, edit, delete, restore, and undo.
6. Write/approve the history ADR, then migrate history without a dual-writer interval.
7. Remove obsolete direct-write and fixed-delay code after metric and data-integrity
   comparison.

During rollout, keep the existing Firestore listeners as the canonical server view and
deduplicate strictly by document ID. Do not loosen security rules to mask client auth
races.

Each phase has a rollback switch that restores blocking UI while leaving the service
boundary intact. Do not roll back data schemas or delete pending documents as part of a
client rollback.

## Success Metrics

- Median and p95 Save-tap-to-Firestore-invocation/`onClose` latency, with native animation
  and local-listener latency reported separately.
- Median and p95 Firestore-invocation-to-acknowledgement latency.
- Percentage of mutations pending longer than 2, 10, and 60 seconds.
- Retry success rate by normalized error category.
- Permission-denied rate with stable auth versus recovering auth.
- Duplicate activity-log rate by operation/document identity.
- Activity-history reconciliation failure and repair rate.
- User-triggered discard rate for failed mutations.

## Open Decisions

- Whether durable history reconciliation uses a Firestore trigger or callable plus repair
  pass. This is resolved by an ADR before WP4 and does not block WP1-WP3.
- Exact pending indicator and snackbar component to reuse or introduce.
- Automatic retry attempt count and backoff values after observing real error telemetry.
- Exact visual distinction for provisional totals; the semantic decision is fixed:
  pending may be included as provisional, failed is excluded.

## Review and Release Gates

The feature does not advance to broad rollout until all of the following are true:

- Device tests confirm the installed SDK's local listener, acknowledgement, offline, and
  sign-out behavior on both platforms.
- A blind replay test fails under the current rules and the reconciliation path passes.
- Every log total/list consumer is inventoried and confirmed to use only Firestore
  listener rows; operation decoration cannot add data rows.
- Account-switch tests demonstrate zero previous-UID UI exposure or app-level flushing.
- Create/edit/undo ordering tests demonstrate that stale completions are ignored.
- Failed mutations are excluded from confirmed totals.
- Persisted history never includes a merely local pending write.
- Crashlytics/analytics payloads contain no names, emails, notes, or entered values.
- The durable history ADR is approved before WP4 starts.
