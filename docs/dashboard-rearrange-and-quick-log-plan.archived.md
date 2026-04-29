# Dashboard Rearrange Mode + Long-Press Quick Log (ARCHIVED)

> **Status: archived 2026-04-29.** Superseded by `dashboard-quick-log-chip-plan.md`, which uses a visible "+N" chip on each card instead of long-press, and leaves the existing long-press-to-rearrange behavior untouched. Kept on disk in case we want to revisit the rearrange-mode + long-press-to-log direction.

## Goal

Split the dashboard's two card gestures so each has a dedicated, non-conflicting interaction:

- **Rearrange** moves out of long-press into an explicit mode entered via a header button.
- **Long-press** is freed up to **quick-log a default quantity** for that standard.

This makes task completion faster (one long-press instead of opening the standard) without sacrificing the ability to reorder.

## UX

### Rearrange mode

- Header gets a **Rearrange** button. Tapping it enters rearrange mode and the button label flips to **Done**.
- In rearrange mode:
  - Cards wiggle (gentle continuous animation, no border).
  - Cards are draggable to reorder; drop persists the new order.
  - Tap and long-press on cards are **disabled** — no navigation, no quick-log.
- Tapping **Done** (or backgrounding the screen) exits rearrange mode and resumes normal interaction.

### Long-press to quick-log (normal mode)

- Long-press on a card whose standard has a `defaultQuantity` set:
  - Writes a log entry with that quantity and the standard's existing unit.
  - Triggers haptic feedback.
  - Shows a toast: "Logged {quantity} {unit} — {standardName}" with an **Undo** button. Toast auto-dismisses on a timer; tap-outside or X button also dismisses. (Match whatever toast pattern already exists; introduce a shared toast component if none exists.)
  - **Undo** deletes the log entry that was just written.
- Long-press on a card whose standard has **no** `defaultQuantity`:
  - Opens a small prompt sheet explaining "Set a default quantity to log with one tap" and a button that routes to the standard's edit screen with the default-quantity field focused.
- Repeated long-presses on the same card log multiple entries — each gets its own toast/undo. No debouncing.

## Data model

### `packages/shared-model/`

Add an optional field to the standard schema:

```ts
defaultQuantity: z.number().optional()
```

- Inherits the same numeric/decimal rules as the existing per-log quantity input.
- No backfill — existing standards simply have no default until the user sets one.
- Rebuild the package (`npm run build`) after the schema change.

## Implementation

### 1. Shared model

- Add `defaultQuantity?: number` to the standard Zod schema and TS type.
- Rebuild `packages/shared-model`.

### 2. Standard create / edit screens

- Add a "Default quantity (optional)" input alongside the existing quantity-related fields.
- Reuse the same numeric input component / validation used for normal quantity entry.
- Persist via the existing standard create/update path.

### 3. Dashboard rearrange mode

- Add `isRearranging` state — local screen state (or a small Zustand slice if it needs to be read elsewhere).
- Header right-side button toggles `isRearranging`; label is "Rearrange" / "Done".
- Card component:
  - When `isRearranging` is true: run wiggle animation (Reanimated loop), enable drag-to-reorder, disable tap and long-press handlers.
  - When false: normal tap-to-navigate + long-press-to-log.
- Drag-end handler persists the new order through the existing standards service (do not write directly from the screen).

### 4. Long-press quick-log (normal mode)

- Pure utility in `apps/mobile/src/utils/`:
  ```ts
  function buildLogEntryFromDefault(standard, now): LogEntry | null
  ```
  Returns the log payload when `defaultQuantity` is set; returns `null` otherwise.
- Hook (e.g. `useQuickLog`) consumes a logging service. On long-press:
  - If util returns a payload → call service, fire haptic, show toast with undo.
  - If util returns `null` → emit an event the dashboard handles by opening the "set a default" prompt sheet.
- Undo handler calls the logging service's delete with the id returned from the create call.
- Toast: reuse existing component if there is one; otherwise add a shared one in `apps/mobile/src/components/`.

### 5. No-default prompt sheet

- Small modal/sheet component.
- Copy: explains the default-quantity feature; primary button navigates to the standard's edit screen with the new field focused (use a route param, e.g. `focusField: 'defaultQuantity'`).

## Tests

Per project rules, the non-trivial logic gets unit tests:

- `buildLogEntryFromDefault`
  - Returns payload when `defaultQuantity` is set (integer and decimal cases).
  - Returns `null` when `defaultQuantity` is absent.
  - Carries through the standard's unit and id.
- Rearrange state hook
  - Enter and exit transitions.
  - Tap/long-press handlers no-op while rearranging (test the wiring at the hook level).
- Quick-log hook
  - Calls log-create service with the right payload on long-press.
  - Undo calls log-delete with the id returned from create.
  - No-default path emits the prompt event and does not call create.

Trivial wiring (button label flip, toast rendering) is not tested.

## Open questions / follow-ups

- Confirm whether a shared toast component already exists. If not, decide its API before building (`show({ message, action })` is the likely shape).
- Confirm route-param convention for focusing a specific field on the standard edit screen.
- Decide haptic style (light vs. medium impact) — match whatever the rest of the app uses for "action completed."
