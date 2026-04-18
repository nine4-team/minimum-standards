# Refactoring Prompt: Accountability Groups — Testability

## Context

The Accountability Groups feature was implemented across Phases 1–4 but violates the project's code quality standards (see `/CLAUDE.md`). The code works structurally (TypeScript compiles, navigation wired up) but is not testable. Your job is to refactor it for testability and write the tests.

Read these files before starting:
- `/CLAUDE.md` — project coding standards (testability, modular functions, service layer)
- `docs/accountability-groups-design.md` — feature design
- `docs/accountability-groups-implementation.md` — work packages and what was built

## What's wrong

### 1. Cloud Functions: all logic inline

**File:** `functions/index.js`

Eight `onCall` handlers (`createGroup`, `joinGroup`, `leaveGroup`, `transferAdmin`, `removeMember`, `updateDisplayName`, `getMemberDashboard`, `getMemberStandardDetail`) have validation, business logic, and Firestore I/O tangled together.

`computeStreak` is already extracted as a pure function — good. But stat computation (metCount, avgCompletion), invite code generation, and admin-transfer-on-leave logic are all inline.

**Refactor:**
- Extract pure logic into a `functions/groupsLogic.js` module:
  - `computeStreak(visibleHistory, visibleStandards)` — already exists, move it
  - `computeMemberStats(visibleHistory, visibleStandards)` — returns `{ metCount, totalCount, avgCompletion }`
  - `generateInviteCode()` — already exists, move it
  - `determineNewAdmin(members, leavingUid)` — returns the UID of the oldest remaining member
  - `validateGroupName(name)` — returns `{ valid: boolean, error?: string }`
  - `validateDisplayName(name)` — returns `{ valid: boolean, error?: string }`
- Keep the `onCall` handlers in `functions/index.js` as thin wrappers: authenticate → validate → call logic → write to Firestore → return.

**Tests to write:** `functions/__tests__/groupsLogic.test.js`
- `computeStreak`: zero standards, all met for 3 periods, one missed in the middle, current in-progress period skipped, hidden standards filtered out
- `computeMemberStats`: empty standards, mix of met/missed, standards with no history
- `determineNewAdmin`: two members, oldest wins; single remaining member
- `generateInviteCode`: returns 8 chars, no ambiguous characters (I/O/0/1)
- Validation functions: empty, too long, valid

### 2. Hooks: inline stub callables, no service layer

**Files:**
- `apps/mobile/src/hooks/useMemberDashboard.ts`
- `apps/mobile/src/hooks/useMemberStandardDetail.ts`
- `apps/mobile/src/hooks/useDisplayName.ts`

Each file has its own copy-pasted stub:
```ts
const functions: any = () => ({
  httpsCallable: (name: string) => async (data: any) => {
    throw Object.assign(new Error('Functions package not available'), { code: 'functions/unavailable' });
  },
});
```

This also exists in `useSuggestStandards.ts` (pre-existing).

**Refactor:**
- Create `apps/mobile/src/services/cloudFunctions.ts`:
  - Exports a `callFunction(name: string, data: any): Promise<any>` wrapper
  - Contains the stub in one place (with the comment explaining the `@react-native-firebase/functions` blocker)
  - When the package is eventually installed, only this file changes
- Create `apps/mobile/src/services/groupsService.ts`:
  - `createGroup(name: string, displayName: string): Promise<{ groupId: string; inviteCode: string }>`
  - `joinGroup(inviteCode: string, displayName: string): Promise<{ groupId: string }>`
  - `leaveGroup(groupId: string): Promise<{ deleted: boolean }>`
  - `removeMember(groupId: string, targetUid: string): Promise<void>`
  - `transferAdmin(groupId: string, newAdminUid: string): Promise<void>`
  - `getMemberDashboard(groupId: string): Promise<MemberDashboardData>`
  - `getMemberStandardDetail(groupId: string, memberUid: string, standardId: string): Promise<MemberStandardDetailData>`
  - `updateDisplayName(displayName: string): Promise<void>`
  - Each function calls `callFunction()` and maps errors to user-facing messages
- Update hooks to import from `groupsService.ts` instead of having inline stubs
- Update `useSuggestStandards.ts` to use `callFunction()` too (consolidate the pre-existing stub)

**Tests to write:** `apps/mobile/src/services/__tests__/groupsService.test.ts`
- Mock `callFunction` at the module level
- Test each service function: correct arguments passed, success response shaped correctly, error codes mapped to correct messages

**Tests to write:** `apps/mobile/src/hooks/__tests__/useMemberDashboard.test.ts` (and similar for other hooks)
- Mock `groupsService`
- Test: initial state is loading, successful fetch sets data, error sets error message, refetch works

### 3. Screens: direct callable invocations

**Files:**
- `apps/mobile/src/screens/CreateGroupScreen.tsx` — has inline stub + calls `functions().httpsCallable('createGroup')` directly
- `apps/mobile/src/screens/JoinGroupScreen.tsx` — same pattern with `joinGroup`
- `apps/mobile/src/screens/GroupDetailScreen.tsx` — same pattern with `leaveGroup` and `removeMember`

**Refactor:**
- Remove all inline stubs from screens
- Screens should call functions from `groupsService.ts` (imported directly, or through hooks if state management is needed)
- For `CreateGroupScreen` and `JoinGroupScreen`, creating dedicated hooks is optional — calling the service directly in a callback is fine since these are one-shot actions, not subscriptions. But the service layer must be the call site, not an inline stub.

No screen-level tests needed — the logic is in services and hooks now.

### 4. StandardsBuilderScreen: inline Firestore write for hiddenFromGroup

**File:** `apps/mobile/src/screens/StandardsBuilderScreen.tsx`

The `hiddenFromGroup` field is written to Firestore directly in the screen's save handler using raw `doc().update()`. This should go through `useStandards` or a service function.

**Refactor:**
- Add `hiddenFromGroup` to the `UpdateStandardInput` interface in `useStandards.ts` as an optional field
- Include it in the `updateStandard` payload when present
- Remove the direct Firestore write from `StandardsBuilderScreen.tsx`
- Remove the `doc`, `collection`, `serverTimestamp` imports that were added to the screen just for this

## Verification

After refactoring:
1. Run `npx tsc --noEmit` — no new errors in modified files
2. Run tests — all pass
3. Run `node -c functions/index.js` — syntax check passes
4. Run `cd packages/shared-model && npm run build` — builds clean
5. Grep for inline stub pattern (`httpsCallable.*=>.*async`) — should only exist in `services/cloudFunctions.ts`

## Files you'll modify

| File | Action |
|------|--------|
| `functions/index.js` | Extract logic to `groupsLogic.js`, keep thin wrappers |
| `functions/groupsLogic.js` | **New** — pure business logic |
| `functions/__tests__/groupsLogic.test.js` | **New** — unit tests |
| `apps/mobile/src/services/cloudFunctions.ts` | **New** — centralized callable stub |
| `apps/mobile/src/services/groupsService.ts` | **New** — groups service layer |
| `apps/mobile/src/services/__tests__/groupsService.test.ts` | **New** — service tests |
| `apps/mobile/src/hooks/useMemberDashboard.ts` | Use `groupsService` instead of inline stub |
| `apps/mobile/src/hooks/useMemberStandardDetail.ts` | Use `groupsService` instead of inline stub |
| `apps/mobile/src/hooks/useDisplayName.ts` | Use `groupsService` instead of inline stub |
| `apps/mobile/src/hooks/useSuggestStandards.ts` | Use `cloudFunctions` instead of inline stub |
| `apps/mobile/src/screens/CreateGroupScreen.tsx` | Use `groupsService`, remove inline stub |
| `apps/mobile/src/screens/JoinGroupScreen.tsx` | Use `groupsService`, remove inline stub |
| `apps/mobile/src/screens/GroupDetailScreen.tsx` | Use `groupsService`, remove inline stub |
| `apps/mobile/src/screens/StandardsBuilderScreen.tsx` | Remove direct Firestore write, use `useStandards` |
| `apps/mobile/src/hooks/useStandards.ts` | Add `hiddenFromGroup` to `UpdateStandardInput` |
