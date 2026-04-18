# Accountability Groups — Implementation Plan

**Design doc:** `docs/accountability-groups-design.md`  
**Created:** 2026-04-17  
**Last updated:** 2026-04-17

---

## Progress Key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Phase 1: Backend Foundation

No mobile dependencies. Can be fully parallelized internally.

### WP-1: Firestore Security Rules `[x]`

**Target:** `firebase/firestore.rules`  
**Do:**
- Add `accountabilityGroups` collection rules:
  - Read: allow if `request.auth.uid in resource.data.memberUids`
  - Write: deny (Cloud Functions handle all writes via admin SDK)
- Add `users/{uid}` document rule for `displayName` field (owner write only)

**Verify:** Deploy rules to emulator. Confirm member can read group doc, non-member cannot. Confirm client-side write to group doc is rejected.

---

### WP-2: Cloud Functions — Group Management `[x]`

**Target:** `functions/index.js`  
**Do:** Add `onCall` functions:

| Function | Inputs | Logic |
|----------|--------|-------|
| `createGroup` | `name` | Create group doc, caller is admin, generate unique invite code, add caller to members map + memberUids. Prompt requires `displayName` — write to `users/{uid}.displayName` if not set. |
| `joinGroup` | `inviteCode` | Look up group by invite code. Validate cap not reached, user not already member. Add to members + memberUids. Require `displayName`. |
| `leaveGroup` | `groupId` | Remove caller. If admin, transfer to oldest member. If last member, delete group. |
| `transferAdmin` | `groupId`, `newAdminUid` | Validate caller is admin, target is member. Update `createdByUid`. |
| `removeMember` | `groupId`, `targetUid` | Validate caller is admin, target is not admin. Remove from members + memberUids. |
| `updateDisplayName` | `displayName` | Write to `users/{uid}.displayName`. Fan out to all groups where user is member. |

**Verify:** Call each function from Firebase shell or test harness. Confirm group doc state is correct after each operation. Confirm invite code lookup works. Confirm cap enforcement. Confirm admin transfer on leave.

---

### WP-3: Cloud Functions — Data Access `[x]`

**Depends on:** WP-2 (group docs must exist to test)  
**Target:** `functions/index.js`  
**Do:** Add `onCall` functions:

| Function | Inputs | Returns |
|----------|--------|---------|
| `getMemberDashboard` | `groupId` | For each member: displayName, standards met count/total, streak, avg completion %. Reads from `/users/{memberUid}/standards` (active, not hiddenFromGroup) and `/users/{memberUid}/activityHistory`. |
| `getMemberStandardDetail` | `groupId`, `memberUid`, `standardId` | Standard doc + activityHistory for that standard. Validate standard is not hiddenFromGroup. |

**Streak logic:**
1. Query `activityHistory` ordered by `periodStartMs` desc
2. Filter out standards with `hiddenFromGroup: true`
3. Group entries by period (using `periodKey`)
4. Period is "met" if every active non-hidden standard has status `"Met"`
5. Count consecutive met periods backward from last *completed* period

**Verify:** Seed two test users with standards and activity history. Call `getMemberDashboard` — confirm stats are correct. Add a `hiddenFromGroup: true` standard — confirm it's excluded from stats and detail.

---

## Phase 2: Mobile — Types, State, Navigation

Depends on Phase 1 (functions must be deployed to call from mobile).

### WP-4: Types & Navigation Setup `[x]`

**Targets:**
- `apps/mobile/src/navigation/types.ts` — add param types for new screens
- `apps/mobile/src/navigation/BottomTabNavigator.tsx` — add Groups tab
- New file: `apps/mobile/src/navigation/GroupsStack.tsx` — stack navigator for group screens

**Do:**
- Add to `BottomTabParamList`: `Groups` route
- Add `GroupsStackParamList`: `GroupsList`, `CreateGroup`, `JoinGroup`, `GroupDetail` (params: `groupId`), `MemberDashboard` (params: `groupId`, `memberUid`, `displayName`), `MemberStandardDetail` (params: `groupId`, `memberUid`, `standardId`, `standardName`)
- Add Groups tab in `BottomTabNavigator` with icon `group`
- Add to `NAV_ICONS` and `NAV_LABELS`

**Verify:** App builds. Groups tab appears in nav bar. Tapping it shows empty stack.

---

### WP-5: Hooks `[x]`

**Target:** `apps/mobile/src/hooks/` (new files)  
**Do:**

| Hook | File | Type | What it does |
|------|------|------|-------------|
| `useMyGroups` | `useMyGroups.ts` | Firestore `onSnapshot` | Listens to `accountabilityGroups` where `memberUids array-contains uid`. Returns list of groups with name, member count, user's role. |
| `useMemberDashboard` | `useMemberDashboard.ts` | Cloud Function call | Calls `getMemberDashboard`, returns member list with stats. Loading/error states. |
| `useMemberStandardDetail` | `useMemberStandardDetail.ts` | Cloud Function call | Calls `getMemberStandardDetail`, returns standard + history. Loading/error states. |
| `useDisplayName` | `useDisplayName.ts` | Firestore doc listener + Cloud Function | Reads `users/{uid}.displayName`. Provides `setDisplayName` that calls `updateDisplayName` function. |

**Verify:** Each hook can be imported without error. Unit test `useMyGroups` with Firestore emulator if test infra supports it.

---

### WP-6: Standard — hiddenFromGroup Field `[x]`

**Targets:**
- Standard type definition (find where `Standard` interface lives — likely inline in hooks or a types file)
- `apps/mobile/src/stores/standardsBuilderStore.ts` — add field to builder if standards are created through it
- Standard settings/edit UI — add "Visible to group" toggle

**Do:**
- Add `hiddenFromGroup?: boolean` to Standard type (default `false`)
- Add toggle in standard edit UI: label "Visible to group", maps to `!hiddenFromGroup`
- On save, write field to Firestore

**Verify:** Create a standard, toggle visibility off. Confirm Firestore doc has `hiddenFromGroup: true`. Toggle back on, confirm field is `false`.

---

## Phase 3: Mobile — Screens

Depends on WP-4 (navigation) and WP-5 (hooks).

### WP-7: GroupsListScreen `[x]`

**Target:** New file `apps/mobile/src/screens/GroupsListScreen.tsx`  
**Do:**
- Uses `useMyGroups` hook
- Shows list of groups (name, member count)
- Empty state: message + "Create Group" and "Join Group" buttons
- Non-empty: list + FAB or header buttons for create/join
- Tapping a group navigates to `GroupDetail`

**Verify:** Screen renders. Empty state shows buttons. After creating a group (via WP-8), it appears in the list.

---

### WP-8: CreateGroupScreen `[x]`

**Target:** New file `apps/mobile/src/screens/CreateGroupScreen.tsx`  
**Do:**
- Name input field
- If user has no displayName, prompt for it first (inline field or modal)
- Calls `createGroup` Cloud Function
- On success: shows invite code with share/copy action
- Navigates to GroupDetail or back to list

**Verify:** Enter name → group created → invite code displayed → can copy/share. Group appears in list.

---

### WP-9: JoinGroupScreen `[x]`

**Target:** New file `apps/mobile/src/screens/JoinGroupScreen.tsx`  
**Do:**
- Invite code input field
- If user has no displayName, prompt for it first
- Calls `joinGroup` Cloud Function
- Error handling: invalid code, group full
- On success: navigates to GroupDetail

**Verify:** Enter valid code → joins group → see group detail. Enter invalid code → error shown. Enter code for full group → cap error shown.

---

### WP-10: GroupDetailScreen `[x]`

**Depends on:** WP-5 (`useMemberDashboard`)  
**Target:** New file `apps/mobile/src/screens/GroupDetailScreen.tsx`  
**Do:**
- Header: group name
- Member list using `useMemberDashboard` data
- Each row: displayName, 3 stats (standards met, streak, avg %)
- Tapping a member → `MemberDashboard`
- Admin actions: show invite code (share/copy), kick member (swipe or long-press), transfer admin
- Non-admin: show invite code is NOT visible (only admin can invite)

**Verify:** Member list renders with correct stats. Tapping member navigates to dashboard. Admin can see invite code and kick a member. Non-admin cannot.

---

### WP-11: MemberDashboardScreen `[x]`

**Target:** New file `apps/mobile/src/screens/MemberDashboardScreen.tsx`  
**Do:**
- Reuse `ActiveStandardsDashboardScreen` layout/components in read-only mode
- Fetch data via `useMemberStandardDetail` or a batch approach
- Header shows member's displayName
- No edit actions, no FAB, no drag-to-reorder
- Tapping a standard → `MemberStandardDetail`

**Verify:** Shows member's active standards grid. No edit controls visible. Tapping a standard navigates to detail.

---

### WP-12: MemberStandardDetailScreen `[x]`

**Target:** New file `apps/mobile/src/screens/MemberStandardDetailScreen.tsx`  
**Do:**
- Reuse `StandardDetailScreen` layout in read-only mode
- Fetch via `useMemberStandardDetail`
- Shows: standard name, progress bar, period info, session count, period history
- No: activity log entries, notes, edit/delete actions

**Verify:** Shows standard progress and period history. No edit controls. No activity log details.

---

## Phase 4: Polish & Edge Cases

### WP-13: Edge Cases & Error Handling `[x]`

**Do:**
- Handle user removed from group while viewing it (listener updates, navigate back)
- Handle admin leaving (confirm dialog, explain transfer)
- Handle group deleted while viewing
- Loading and error states for all Cloud Function calls
- Offline handling (show stale data or "no connection" message)

**Verify:** Simulate each scenario. App doesn't crash. User sees appropriate feedback.

---

## Dependency Graph

```
Phase 1 (backend):     WP-1 ──┐
                        WP-2 ──┤── all parallel except WP-3 depends on WP-2
                        WP-3 ──┘

Phase 2 (plumbing):    WP-4 ──┐
                        WP-5 ──┤── all parallel, depend on Phase 1
                        WP-6 ──┘

Phase 3 (screens):     WP-7  ──┐
                        WP-8  ──┤
                        WP-9  ──┤── all depend on WP-4 + WP-5
                        WP-10 ──┤   WP-10 thru WP-12 also depend on WP-6
                        WP-11 ──┤
                        WP-12 ──┘

Phase 4 (polish):      WP-13 ── depends on all above
```

---

## Phase 5: Group Feed & Notifications (Future)

Not in scope for initial build. Documented here so it's ready when we get to it.

### WP-14: Group Activity Feed `[ ]`

**Concept:** A feed on the GroupDetailScreen showing recent member activity — "Ben met Cold Calls," "Sara hit a 12-week streak," "Alex logged 5/6 standards today." This is the in-app version of push notifications. Build this first since it doesn't require push infra.

**Backend:**
- New Firestore subcollection: `accountabilityGroups/{groupId}/feed/{eventId}`
- Events written by a Cloud Function trigger (e.g., `onWrite` to `activityHistory`) when a member meets a standard or hits a streak milestone
- Event doc: `{ memberUid, displayName, type (standard_met | streak_milestone | all_met), detail, createdAtMs }`
- Feed is append-only, TTL or cap to keep it bounded (e.g., last 50 events)

**Mobile:**
- Tab or section on GroupDetailScreen: "Members" vs "Activity"
- Feed list with timestamps, grouped by day
- Hook: `useGroupFeed` (Firestore listener on feed subcollection, ordered by createdAtMs desc)

### WP-15: Push Notifications `[ ]`

**Depends on:** WP-14 (feed events are the notification source)

**Concept:** Same events that write to the feed also trigger push notifications to other group members. User can mute per-group.

**Backend:**
- Store FCM tokens on `users/{uid}.fcmTokens` array
- Cloud Function: on feed event write, send FCM to all other group members (respect mute preference)
- New field on group member: `muted: boolean`

**Mobile:**
- FCM registration on app launch (already may exist for other features — check)
- Notification permission prompt
- Per-group mute toggle in GroupDetailScreen settings
- Tapping notification deep-links to GroupDetailScreen

---

## Agent Instructions

**Manager agent workflow:**
1. Execute Phase 1 work packages. WP-1 and WP-2 can run in parallel. WP-3 runs after WP-2.
2. Review and deploy Phase 1 before starting Phase 2.
3. Execute Phase 2 work packages in parallel (WP-4, WP-5, WP-6).
4. Review Phase 2. Confirm app builds with new nav tab.
5. Execute Phase 3 screens. WP-7, WP-8, WP-9 can run in parallel. WP-10 after those. WP-11 and WP-12 after WP-10.
6. Review each screen against verify criteria.
7. Execute WP-13 last.

**Sub-agent context:** Each sub-agent receives this file + the design doc. They should read the target files before modifying them. They should follow existing code patterns (Zustand stores, hook conventions, screen structure, theme usage).
