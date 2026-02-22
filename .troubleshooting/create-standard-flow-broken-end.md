# Issue: Create Standard flow doesn't dismiss after submit — lands on broken SetVolume screen

**Status:** Active
**Opened:** 2026-02-21
**Resolved:** _pending_

## Info
- **Symptom:** After completing the Create Standard flow (submitting on SetPeriod), user ends up on the SetVolume screen with a gray disabled Next button and the unit field showing '—' instead of being dismissed back to the dashboard.
- **Affected area:** `apps/mobile/src/screens/create-standard/SetPeriodStep.tsx`, `apps/mobile/src/navigation/CreateStandardFlow.tsx`

### Navigation hierarchy
```
MainStack (NativeStackNavigator)
  ├── MainTabs (BottomTabNavigator)
  └── CreateStandardFlow (fullScreenModal)
       └── Inner Stack (NativeStackNavigator)
            ├── SelectActivity  (step 0)
            ├── SetVolume       (step 1)
            └── SetPeriod       (step 2)
```
(`MainStack.tsx:21-25`, `CreateStandardFlow.tsx:130-143`)

### How submit works (SetPeriodStep:182-204)
```js
await createStandard(payload);   // 1. Save to Firestore
reset();                          // 2. Clear builder store (selectedActivity → null, goalTotal → null)
mainNavigation.goBack();          // 3. Attempt to dismiss flow
```

### Key observation
`useNavigation()` in React Navigation returns the navigation prop for the **nearest** enclosing navigator. Both `flowNavigation` and `mainNavigation` in SetPeriodStep resolve to the **inner** CreateStandardFlow stack navigator at runtime — the TypeScript types don't change runtime behavior.

From SetPeriod, the inner stack has screens to go back to (SelectActivity, SetVolume), so `goBack()` pops within the inner stack → lands on SetVolume instead of dismissing the flow.

### Secondary issue: close (X) button
`SetVolumeStep.tsx:56-58` and `SetPeriodStep.tsx:213` both call `mainNavigation.goBack()` for the close button. From SetVolume and SetPeriod, this navigates to the previous step in the inner flow instead of dismissing the entire CreateStandardFlow modal. The close button on SelectActivity works correctly because it's the root of the inner stack, so `goBack()` propagates to the parent MainStack navigator.

### Store reset timing
`CreateStandardFlow.tsx:121-128` — the `useEffect` cleanup calls `reset()` on unmount. This means the explicit `reset()` in `handleSubmit` is redundant when the flow is properly dismissed. Currently it causes the store to clear while the broken SetVolume screen is visible, producing the '—' unit and gray button.

## Experiments

### H1: `goBack()` pops within the inner stack instead of dismissing the flow
- **Rationale:** `useNavigation()` returns the nearest navigator (inner CreateStandardFlow stack). From SetPeriod, the inner stack is [SelectActivity, SetVolume, SetPeriod] — `goBack()` pops to SetVolume. After `reset()` clears the store, SetVolume re-renders with null selectedActivity (unit → '—') and null goalTotal (canProceed → false → gray button).
- **Experiment:** Code read confirms the navigation hierarchy (MainStack.tsx, CreateStandardFlow.tsx) and that SetPeriodStep uses `useNavigation()` which resolves to the inner stack. No runtime test needed — this is deterministic from the React Navigation docs + code structure.
- **Result:** Confirmed by code analysis:
  - `MainStack.tsx:21-25`: CreateStandardFlow is a screen in MainStack
  - `CreateStandardFlow.tsx:130-143`: inner stack has 3 screens
  - `SetPeriodStep.tsx:67`: `flowNavigation = useNavigation<FlowNav>()` — nearest navigator is inner stack
  - `SetPeriodStep.tsx:68`: `mainNavigation = useNavigation<MainNav>()` — SAME nearest navigator, just different TS type
  - `SetPeriodStep.tsx:196`: `reset()` clears store before navigation
  - `SetPeriodStep.tsx:197`: `mainNavigation.goBack()` pops inner stack → SetVolume
- **Verdict:** Confirmed

## Fix Applied (pending device verification)

- **Root cause:** `useNavigation()` returns the nearest navigator. Both `flowNavigation` and `mainNavigation` in SetPeriodStep resolve to the inner CreateStandardFlow stack. `goBack()` pops within that stack (SetPeriod → SetVolume) instead of dismissing the full-screen modal.
- **Fix:** Use `flowNavigation.getParent<MainStackParamList>()` to get the MainStack navigator, then call `goBack()` on that. Removed redundant `reset()` from `handleSubmit` (unmount cleanup handles it). Same fix applied to close (X) buttons on SetVolumeStep and SetPeriodStep.
- **Files changed:**
  - `apps/mobile/src/screens/create-standard/SetPeriodStep.tsx`
  - `apps/mobile/src/screens/create-standard/SetVolumeStep.tsx`

## Resolution
_Awaiting user device verification._
