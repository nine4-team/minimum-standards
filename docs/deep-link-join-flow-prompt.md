# Delegation: Deep-Link Join Flow for Accountability Groups

## Context

Accountability Groups currently have a `JoinGroupScreen` where users manually type an 8-character invite code. This is clunky. The desired flow:

1. Admin creates a group → sees an invite link (URL, not a raw code)
2. Admin shares the link via iMessage, Slack, etc.
3. Recipient taps link → preview page opens in browser → taps "Open in Minimum Standards" → app opens → auto-joins the group
4. If the user isn't signed in or needs a display name, handle that inline — don't drop them on a dead screen

The app already has this exact pattern for snapshot sharing. Study it before building:

- `functions/index.js` → `exports.sharePage` — `onRequest` Cloud Function that serves an HTML page with OG tags and a `minimumstandards://snapshot/{code}` deep link
- `apps/mobile/src/hooks/useSnapshotImportFlow.ts` — listens for `Linking` events, extracts share code from URL, triggers import
- `apps/mobile/src/utils/snapshotLinks.ts` — `extractShareCodeFromUrl()` parses the deep link URL

Read these files before starting. Follow the same patterns.

Also read:
- `/CLAUDE.md` — project coding standards
- `apps/mobile/src/services/groupsService.ts` — the service layer for group operations
- `apps/mobile/src/hooks/useDisplayName.ts` — checks if user has a display name
- `apps/mobile/src/navigation/types.ts` — `GroupsStackParamList` type definitions

## What to build

### 1. Cloud Function: `groupJoinPage`

**File:** `functions/index.js`

Add an `onRequest` Cloud Function, modeled on `sharePage`:

- Route: serves at `/group/join/{inviteCode}` (or extract invite code from path/query params the same way `getShareCodeFromRequest` does)
- Looks up the group by invite code in Firestore
- If valid: serves HTML with OG tags (`og:title` = group name, `og:description` = "Join {groupName} on Minimum Standards!") and a deep link: `minimumstandards://group/join/{inviteCode}`
- If invalid/not found: serves HTML saying the link is invalid
- Include the same auto-redirect `<script>` pattern as `sharePage`

Also add routing in `firebase.json` under `hosting.rewrites` so the URL path maps to the function. The existing `sharePage` function may already have a rewrite — check and follow the same pattern. If there's no hosting config yet, add one.

### 2. Deep link handler: `useGroupJoinFlow`

**File:** `apps/mobile/src/hooks/useGroupJoinFlow.ts` (new)

Modeled on `useSnapshotImportFlow.ts`:

- Listen for `Linking` events matching `minimumstandards://group/join/{inviteCode}`
- Extract the invite code from the URL
- If the user is signed in:
  - Check if they have a display name (via `useDisplayName`)
  - If no display name: show an Alert or prompt for it before joining
  - Call `groupsService.joinGroup(inviteCode, displayName)`
  - On success: navigate to `GroupDetail` screen with the returned `groupId`
  - On error: show Alert with the error message (invalid code, group full, already a member)
- If the user is not signed in: store the pending invite code and process it after auth (same pattern as `pendingShareCode` in snapshot flow — check if there's a store for this or create one)

### 3. Wire up the hook

**File:** Find where `useSnapshotImportFlow()` is called (likely `App.tsx` or a root-level component) and add `useGroupJoinFlow()` next to it.

### 4. Update share actions to use URLs instead of raw codes

**Files:**
- `apps/mobile/src/screens/CreateGroupScreen.tsx`
- `apps/mobile/src/screens/GroupDetailScreen.tsx`

Currently these share the raw invite code or a message containing it. Change them to share the URL instead:

- Build the URL: `https://{firebase-hosting-domain}/group/join/{inviteCode}`
  - The hosting domain is likely `minimum-standards.web.app` or similar — check Firebase config
  - Create a utility function `buildGroupJoinUrl(inviteCode: string): string` in a shared location (e.g., `apps/mobile/src/utils/groupLinks.ts`)
- `CreateGroupScreen` success state: the "Share" button sends the URL. The "Copy" button copies the URL. Still display the raw code as a visual reference.
- `GroupDetailScreen` admin menu: "Share Invite Code" becomes "Share Invite Link" and sends the URL

### 5. Remove `JoinGroupScreen`

**Files to modify:**
- `apps/mobile/src/screens/GroupsListScreen.tsx` — remove "Join Group" button from empty state and FAB
- `apps/mobile/src/navigation/GroupsStack.tsx` — remove `JoinGroup` screen from the stack
- `apps/mobile/src/navigation/types.ts` — remove `JoinGroup` from `GroupsStackParamList`

**File to delete:**
- `apps/mobile/src/screens/JoinGroupScreen.tsx`

### 6. Display name prompt

When a user joins via deep link and has no display name, they need to provide one before `joinGroup` is called. Options (pick whichever is simpler):

- **Alert with TextInput** — not natively supported on iOS. Skip this.
- **Navigate to a minimal screen** — repurpose or create a small `DisplayNamePromptScreen` that collects the name, then calls `joinGroup` and navigates to `GroupDetail`. This screen would receive the invite code as a route param.
- **Modal** — a lightweight modal overlay. This might be cleanest.

Whatever you pick, the user should never land on a blank screen or get silently dropped.

## What NOT to do

- Don't remove the `joinGroup` Cloud Function or change its API — the deep link flow calls it the same way
- Don't change the invite code format or generation logic
- Don't add the `JoinGroup` screen back under a different name — joining happens automatically via deep link, not through a manual screen
- Don't put callable invocations directly in screens or hooks — use `groupsService.ts`

## Verification

1. `npx tsc --noEmit` — no new errors
2. `node -c functions/index.js` — syntax OK
3. Grep for `JoinGroup` in navigation files — should not exist as a route
4. Grep for `JoinGroupScreen` — should not be imported anywhere
5. The `sharePage` pattern should be matched: OG tags render in link previews, deep link opens the app
6. Share button on CreateGroupScreen sends a URL, not a raw code
7. Tapping the URL when app is installed opens the app and joins the group (or prompts for display name first)

## Files summary

| File | Action |
|------|--------|
| `functions/index.js` | Add `groupJoinPage` onRequest function |
| `firebase.json` | Add hosting rewrite for group join URL |
| `apps/mobile/src/hooks/useGroupJoinFlow.ts` | **New** — deep link listener + join logic |
| `apps/mobile/src/utils/groupLinks.ts` | **New** — `buildGroupJoinUrl()` |
| `apps/mobile/src/screens/CreateGroupScreen.tsx` | Share URL instead of raw code |
| `apps/mobile/src/screens/GroupDetailScreen.tsx` | Share URL instead of raw code |
| `apps/mobile/src/screens/GroupsListScreen.tsx` | Remove "Join Group" button |
| `apps/mobile/src/navigation/GroupsStack.tsx` | Remove JoinGroup screen |
| `apps/mobile/src/navigation/types.ts` | Remove JoinGroup from param list |
| `apps/mobile/src/screens/JoinGroupScreen.tsx` | **Delete** |
| Root component (where `useSnapshotImportFlow` lives) | Add `useGroupJoinFlow()` |
