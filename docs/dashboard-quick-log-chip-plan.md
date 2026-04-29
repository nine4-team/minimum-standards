# Dashboard Quick-Log Chip

## Goal

Make logging the most common action — adding one default unit toward a standard — a single visible tap. Add an optional `defaultQuantity` to standards; render a `+N` chip in the top-left of each dashboard card when that value is set.

The existing long-press-to-rearrange gesture is **unchanged**. No rearrange mode, no gesture conflicts.

> An earlier plan (`dashboard-rearrange-and-quick-log-plan.archived.md`) explored a Rearrange button + long-press-to-log. Archived because of discoverability concerns with hidden gestures. Kept on disk in case we want to revisit.

## UX

### The chip

- Top-left corner of each standard card, mirroring the existing `…` kebab on the top-right.
- Same size and vertical position as the kebab.
- Label: `+{defaultQuantity}` — e.g. `+1`, `+5`, `+10`. No unit (unit is already labeled under the ring; keep the chip compact).
- Only renders when the standard's `defaultQuantity` is set. Cards without a default look exactly like today.
- Tap zone swallows the event so it does not trigger card / ring navigation.

### Tap behavior

- Writes a log entry with `defaultQuantity` and the standard's existing unit.
- Haptic feedback (match whatever the rest of the app uses for "action completed").
- Toast: "Logged {quantity} {unit} — {standardName}" with an **Undo** button. Toast auto-dismisses on a timer; tap-outside or X also dismisses. Reuse existing toast pattern if there is one; otherwise add a shared toast component.
- **Undo** deletes the log entry just written.
- Repeated taps log multiple entries — each its own toast/undo. No debouncing.

### Setting the default

- New optional "Default quantity" input in the standard create and edit screens, alongside existing quantity-related fields.
- No prompt UI for "no default set" — without a default, there's just no chip. Discovery happens on the standard edit screen.

## Data model

### `packages/shared-model/`

Add to the standard schema:

```ts
defaultQuantity: z.number().optional()
```

- Inherits the same numeric/decimal rules as the existing per-log quantity input.
- No backfill — existing standards have no default until set.
- Rebuild the package (`npm run build`) after the schema change.

## Implementation

### 1. Shared model

- Add `defaultQuantity?: number` to the standard Zod schema and TS type.
- Rebuild `packages/shared-model`.

### 2. Standard create / edit screens

- Add a "Default quantity (optional)" input. Reuse the existing numeric input component / validation used for normal quantity entry.
- Persist via the existing standard create/update path.

### 3. Dashboard card chip

- Conditionally render the chip in the top-left when `standard.defaultQuantity != null`.
- `onPress` handler: call the quick-log hook (below). Stop event propagation so card navigation is not triggered.
- Keep current ring/card tap → navigate behavior intact.
- Keep current long-press → rearrange behavior intact.

### 4. Quick-log hook + utility

- Pure utility in `apps/mobile/src/utils/`:
  ```ts
  function buildLogEntryFromDefault(standard, now): LogEntry | null
  ```
  Returns the log payload when `defaultQuantity` is set; returns `null` otherwise.
- Hook `useQuickLog` consumes a logging service:
  - On chip press → call util, call service create with the payload, fire haptic, surface toast with undo handler.
  - Undo handler calls service delete with the id returned from create.

### 5. Toast

- Reuse existing component if present. If not, add a shared one in `apps/mobile/src/components/` with shape `show({ message, action: { label, onPress } })`.

## Tests

Per project rules, non-trivial logic gets unit tests:

- `buildLogEntryFromDefault`
  - Returns payload when `defaultQuantity` is set (integer and decimal).
  - Returns `null` when absent.
  - Carries through the standard's unit and id.
- `useQuickLog`
  - Calls log-create service with the right payload on press.
  - Undo calls log-delete with the id returned from create.
- Card render
  - Chip renders only when `defaultQuantity` is set (snapshot or simple presence assertion).

Trivial wiring (chip layout position, toast rendering) is not tested.

## Open questions / follow-ups

To be resolved by checking the codebase at implementation time:

- Existing toast component — if present, reuse; if not, propose API.
- Haptic style (light vs medium impact) — match what's already used for "action completed."
- Exact chip styling token — match kebab sizing and the existing card visual language.
