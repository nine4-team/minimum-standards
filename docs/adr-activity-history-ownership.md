# ADR: Durable Activity-History Ownership

**Status:** Proposed — approval required before backend implementation

**Date:** 2026-08-25

## Context

Activity logs are canonical user input. Activity-history documents are derived summaries.
The mobile app currently recomputes those summaries after an acknowledged log write, but
a client can close, lose auth, or lose connectivity between the primary write and the
secondary reconciliation. Concurrent clients can also complete recomputations out of
order.

The mobile resilience work isolates this legacy behavior and prevents its failure from
changing the primary log result. It does not make the derived history durable.

## Decision

Adopt an Admin SDK Firestore trigger as the durable owner of activity-history summaries,
plus a scheduled repair job that re-derives missing or stale deterministic period
documents from canonical activity logs.

The trigger should enqueue or invoke an idempotent recomputation keyed by user, standard,
and affected period. It must recompute from the current canonical log set rather than
apply increments. A monotonic source version or transaction guard must prevent an older
calculation from overwriting a result derived from newer log state.

Edits that move a log timestamp, cadence/configuration changes, soft delete, and restore
must reconcile every old and new affected period. Admin SDK code owns all derived writes;
mobile clients become read-only consumers of activity history after migration.

## Why this option

- It does not depend on the originating device remaining alive after the log commits.
- It naturally observes writes from every client and future import path.
- Re-derivation is safe under at-least-once trigger delivery.
- A scheduled repair pass covers missed events and historical defects.

An idempotent callable alone was rejected because it still depends on a client invoking
it. A callable could remain as an administrative repair entry point, but it should not be
the primary consistency mechanism.

## Rollout constraints

1. Add emulator tests for create, edit across periods, soft delete, restore, duplicate
   delivery, and out-of-order completion.
2. Backfill/repair existing history and compare derived totals before changing ownership.
3. Deploy the trigger and repair path before removing the legacy acknowledged-write
   client reconciliation. Do not leave two durable writers indefinitely.
4. After verification, deny client writes to activity-history documents and remove the
   mobile reconciliation call.
5. Monitor trigger failures and repair lag independently from primary activity-log write
   success.

## Consequences

The functions project gains its first Firestore-triggered path and a repair job, which is
a deliberate expansion beyond the current callable-only convention. In return, history
correctness no longer depends on mobile lifecycle or auth timing. Until this ADR is
approved and implemented, current-period UX remains canonical because it is calculated
directly from activity logs; persisted historical summaries retain the documented
eventual-consistency limitation.
