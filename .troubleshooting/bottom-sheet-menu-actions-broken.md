# Issue: BottomSheetMenu actions never fire — all menus broken

**Status:** Active
**Opened:** 2026-02-11
**Resolved:** _pending_ _

## Info
- **Symptom:** Tapping any menu item in any BottomSheetMenu does nothing. Affects: header options menu (sort, show time bar, manage categories, show inactive), active standard action menu, categorize menu. The menu closes but the action never executes.
- **Affected area:** `BottomSheetMenu.tsx`, `BottomSheet.tsx`, `ActiveStandardsDashboardScreen.tsx`

### Background Research

**BottomSheetMenu pattern (BottomSheetMenu.tsx:28-34):**
- `handleItemPress` stores action in `pendingAction.current` ref, then calls `onRequestClose()`
- `handleDismiss` (passed as `onDismiss` to BottomSheet) reads `pendingAction.current` and executes it via `requestAnimationFrame`
- Intent: defer action execution until after the modal is dismissed to avoid conflicts

**BottomSheet.tsx:58:**
- `if (!visible) return null;` — early return when not visible
- This means when `onRequestClose` sets parent state to `visible=false`, the entire `<Modal>` is **unmounted** from the tree

**BottomSheet.tsx:66:**
- `onDismiss` is passed directly to React Native's `<Modal onDismiss={onDismiss}>`
- RN Modal's `onDismiss` only fires on iOS, not Android
- Even on iOS, it requires the Modal to go through a proper dismiss transition, not an unmount

**The broken chain:**
1. User taps menu item → `handleItemPress` stores action, calls `onRequestClose()`
2. Parent sets `visible=false` → re-render
3. `BottomSheet` receives `visible=false` → returns `null` at line 58
4. Modal is **unmounted** (not dismissed) → `onDismiss` never fires
5. `handleDismiss` never runs → `pendingAction.current` is never executed
6. Action is lost

**Secondary issue:** "Manage Categories" menu item has `icon: 'folder'` (ActiveStandardsDashboardScreen.tsx:815) — user reports this icon shouldn't be there.

## Experiments

### H1: BottomSheet early-return unmounts Modal before onDismiss can fire
- **Rationale:** Line 58 of BottomSheet.tsx returns null when `!visible`, removing the Modal from the tree entirely. The deferred action in `pendingAction.current` depends on `onDismiss` firing, which requires the Modal to still be mounted.
- **Experiment:** Trace the code path: does `onDismiss` ever fire? Check if removing the early return + changing action execution to not depend on `onDismiss` fixes all menus.
- **Result:** Code analysis confirms: `if (!visible) return null` at BottomSheet.tsx:58 unmounts the entire Modal tree. RN Modal `onDismiss` only fires on iOS and requires a proper dismiss (not unmount). The `pendingAction` ref in BottomSheetMenu is set but never read.
- **Verdict:** Confirmed

## Resolution
_Awaiting user verification in the app._

- **Root cause:** The deferred-action pattern (`pendingAction` ref + `onDismiss` callback) never fires because `BottomSheet.tsx:58` unmounts the Modal (`if (!visible) return null`) before `onDismiss` can trigger, and RN's `Modal.onDismiss` is iOS-only regardless.
- **Fix:** Replaced the broken `pendingAction`/`onDismiss` pattern with direct execution via `setTimeout(action, 100)` after calling `onRequestClose()`. This lets the state update flush before running the action, works on both platforms. Applied to all three affected components. Also removed the `icon: 'folder'` from the "Manage Categories" menu item.
- **Files changed:**
  - `apps/mobile/src/components/BottomSheetMenu.tsx` — removed `pendingAction`/`handleDismiss`/`onDismiss`, execute action via setTimeout
  - `apps/mobile/src/components/BottomSheetConfirmation.tsx` — same fix
  - `apps/mobile/src/components/ActivityLogEntry.tsx` — same fix (renamed `closeMenuAndQueueAction` → `closeMenuAndRun`)
  - `apps/mobile/src/screens/ActiveStandardsDashboardScreen.tsx` — removed `icon: 'folder'` from Manage Categories
- **Lessons:** RN `Modal.onDismiss` is iOS-only and unreliable when the component unmounts. Prefer `setTimeout` for post-close actions.
