# Accountability Groups — Design Doc

**Status:** Design  
**Date:** 2026-04-17

## Purpose

Users form small groups to hold each other accountable. Members see each other's standards and progress. Social pressure drives consistency.

## Core Concepts

- **Group**: named collection of up to 10 members (cap is parameterized)
- **Admin**: the user who created the group. Can invite new members.
- **Member**: read-only access to other members' standards and progress
- **Invite**: admin generates an invite code; sharing the code is how new members join

## What Members See

### Member List (Group Screen)

Each member row shows three stats:

| Stat | Source | Example |
|------|--------|---------|
| Standards met this period | Count of active standards with status "Met" vs total active | 4/6 Met |
| Consecutive periods streak | Derived from activityHistory — count of unbroken periods where all active non-hidden standards are "Met" | 12-week streak |
| Average completion % | Mean of progressPercent across all active non-hidden standards | 78% |

### Member Detail (Tap Into a Member)

- Shows their active standards grid (reuses ActiveStandardsDashboard in read-only mode)
- Tapping a standard shows StandardDetail (read-only) — progress bar, period info, session count
- No access to: raw activity logs, notes, archived standards

### Privacy

- Per-standard `hiddenFromGroup` boolean flag (default: `false`)
- Toggle lives in standard settings ("Visible to group")
- Hidden standards are excluded from group stats and not shown to members
- User's own view is unaffected

## Data Model

### New Firestore Collections

```
accountabilityGroups/{groupId}
  name: string
  createdByUid: string          # admin
  memberCap: number             # default 10, parameterized
  members: map<uid, {
    displayName: string,
    joinedAtMs: number
  }>
  memberUids: string[]          # for array-contains queries
  inviteCode: string            # unique, one per group
  createdAtMs: number
  updatedAtMs: number
```

### Modified Documents

```
users/{uid}/standards/{standardId}
  + hiddenFromGroup: boolean    # new field, default false
```

```
users/{uid}
  + displayName: string         # new field, needed for group member list
```

No new subcollections under users. Group reads pull from existing `/users/{uid}/standards` and `/users/{uid}/activityHistory`.

## Architecture

### Cross-User Reads via Cloud Functions

Current Firestore rules are owner-only. Rather than opening read access with complex rules, cross-user data flows through Cloud Functions:

- `getMemberDashboard(groupId, memberUid)` — validates caller is in the group, fetches member's active non-hidden standards + activityHistory, computes the 3 stats, returns the payload
- `getMemberStandardDetail(groupId, memberUid, standardId)` — validates membership + standard is not hidden, returns standard + period history

This keeps security rules untouched (owner-only) and enforces privacy server-side.

### Real-Time Group List

The group list screen uses a Firestore listener on `accountabilityGroups` where `memberUids array-contains currentUser.uid`. This is the one place we add a read rule — it only exposes group metadata, not other users' standards.

### Streak Computation

Computed server-side in `getMemberDashboard`:

1. Query `activityHistory` for the member, ordered by `periodStartMs` desc
2. Group by period, filter out standards with `hiddenFromGroup: true`
3. A period counts as "met" if every active non-hidden standard has status "Met"
4. Count consecutive met periods from the current one backward
5. If current period is still in progress, start counting from the last completed period

## Cloud Functions

All `onCall`, added to existing `functions/index.js`:

| Function | What it does |
|----------|-------------|
| `createGroup` | Creates group doc, sets caller as admin, generates invite code |
| `joinGroup` | Validates invite code + cap not reached, adds caller to members |
| `leaveGroup` | Removes caller from group. If admin leaves, oldest member becomes admin (or group is deleted if empty) |
| `getMemberDashboard` | Returns member list with 3 stats per member |
| `getMemberStandardDetail` | Returns single standard + period history for a member |
| `transferAdmin` | Validates caller is admin, sets new admin on group doc |
| `removeMember` | Validates caller is admin, removes target from group |
| `updateDisplayName` | Updates `users/{uid}.displayName` and fans out to all group docs |

## Mobile App

### Navigation

New **Groups** tab in bottom nav (4th tab, after Scorecards).

### Screens

| Screen | Description |
|--------|-------------|
| `GroupsListScreen` | Lists user's groups. Empty state with "Create" and "Join" buttons. |
| `CreateGroupScreen` | Name input → creates group → shows invite code to share |
| `JoinGroupScreen` | Paste/enter invite code → joins group |
| `GroupDetailScreen` | Member list with 3 stats per row. Admin sees invite code to share. |
| `MemberDashboardScreen` | Read-only ActiveStandardsDashboard for the selected member |
| `MemberStandardDetailScreen` | Read-only StandardDetail for a specific standard |

### Hooks

| Hook | Type | Description |
|------|------|-------------|
| `useMyGroups` | Firestore listener | Real-time list of groups user belongs to |
| `useMemberDashboard` | Cloud Function call | Fetches member stats for a group |
| `useMemberStandardDetail` | Cloud Function call | Fetches single standard detail |
| `useDisplayName` | Local state + Cloud Function | Manage display name |

### Standard Settings Addition

Add toggle to standard edit/settings:
- "Visible to group" — on by default
- Maps to `hiddenFromGroup` field

## Resolved Questions

1. **Admin transfer** — Yes, admins can explicitly transfer the admin role to another member.
2. **Multiple groups** — Yes, a user can be in more than one group.
3. **Remove member** — Yes, admins can kick members.
4. **Display name prompt** — Prompt on first group create or join.
