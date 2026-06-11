# Configurable Standard Pages Implementation Plan

## Product Goal

Remove the six active-standard limit while preserving a six-card dashboard rhythm. Active standards should be organized into synced, curated pages that users can swipe between. Each page holds up to six standards by default.

## Decisions

- Page configuration must sync across devices, so it belongs in Firestore rather than AsyncStorage-only UI preferences.
- The six-card limit becomes a per-page layout constraint, not an active-standard cap.
- Dashboard page order is user-curated.
- Standards within each dashboard page are user-curated.
- Accountability group statistics continue to count all visible active standards, not only the current dashboard page.
- Other members' standard screens should support the owner's curated page structure when data is available, with a flat list fallback for legacy data.

## Proposed Firestore Shape

Use one user-scoped dashboard layout document:

```text
users/{uid}/preferences/dashboardLayout
```

Suggested fields:

```ts
type DashboardLayoutDoc = {
  pages: Array<{
    id: string;
    name: string;
    orderIndex: number;
  }>;
  pageSize: 6;
  updatedAt: Timestamp;
};
```

Extend standards with page placement fields:

```ts
type Standard = {
  dashboardPageId?: string;
  dashboardOrderIndex?: number;
};
```

Keep existing `orderIndex` readable during migration, but new dashboard ordering should use `dashboardPageId` and `dashboardOrderIndex`.

## Migration And Fallback Rules

No one-time migration is required for the first implementation.

When standards have no page placement:

1. Sort by existing `orderIndex` if present, then by name or updated time using current dashboard behavior.
2. Create virtual pages of six in memory.
3. On first user page edit, page rename, cross-page move, or reorder, write a real `dashboardLayout` doc and `dashboardPageId` / `dashboardOrderIndex` fields.

When `dashboardLayout` is missing:

- Build default virtual pages named `Page 1`, `Page 2`, etc.
- Assign standards into six-card chunks in memory.

When a referenced page id is missing:

- Put affected standards into a generated fallback page.
- Sanitize the layout on the next explicit save.

When a standard is archived or deleted:

- It should disappear from active dashboard pages.
- Its placement fields can remain for future unarchive unless this causes UX confusion.
- On unarchive, restore it to its former page if there is room; otherwise put it in the first page with room or a new page.

## Mobile Architecture

Add pure utilities in `apps/mobile/src/utils/dashboardPages.ts`:

- `buildDashboardPages(standards, layout, pageSize)`
- `sanitizeDashboardLayout(layout, standards)`
- `placeNewStandardInPages(pages, standardId, pageSize)`
- `moveStandardWithinPage(pages, pageId, standardId, targetIndex)`
- `moveStandardAcrossPages(pages, sourcePageId, targetPageId, standardId, targetIndex, pageSize)`
- `renameDashboardPage(layout, pageId, name)`
- `createDashboardPage(layout, name?)`
- `deleteEmptyDashboardPage(layout, pageId)`

Add a service layer in `apps/mobile/src/services/dashboardLayoutService.ts`:

- Subscribe to `users/{uid}/preferences/dashboardLayout`.
- Save layout metadata.
- Save standard page placement updates in batches.

Add a hook in `apps/mobile/src/hooks/useDashboardPages.ts`:

- Consume `useStandards()`.
- Consume `dashboardLayoutService`.
- Expose pages, active page index, active page, swipe handlers, rename/create/delete page actions, and move/reorder actions.
- Keep business rules in utils and I/O in the service.

## Dashboard UI

Update `ActiveStandardsDashboardScreen`:

- Remove active cap UI assumptions.
- Render a horizontal pager where each page contains up to six cards.
- Swipe left/right to navigate pages.
- Show compact page dots or a page label.
- Allow page rename and page creation through a menu.
- Keep drag reorder within a page.
- Add a move action for moving a standard to another page.

Recommended initial scope:

- Swipe pages.
- Page label and dots.
- Rename current page.
- Add page.
- Move standard to page from the card menu.
- Reorder within current page.

Cross-page drag can come later; it is more complex and not required for a strong first version.

## Standard Creation Behavior

Update create-standard flow:

- Remove `ActiveCapExceededError` and `ArchiveToMakeRoomSheet`.
- On create, place the new standard on the first page with fewer than six standards.
- If all pages are full, create a new page and place the standard there.
- After creation, navigate dashboard to the page containing the new standard and highlight the card.

## Group Impact

Cloud Functions currently fetch all active, non-deleted, non-hidden standards for group views.

Required behavior:

- `getMemberDashboard` should continue to compute stats across all visible active standards.
- `getMemberStandards` should return page placement data and enough page metadata to mirror the owner's pages.
- Hidden standards must remain excluded from group responses.
- Group member standard detail remains unchanged except for any shared type additions.

Suggested `getMemberStandards` response:

```ts
{
  pages: Array<{ id: string; name: string; orderIndex: number }>;
  standards: Array<MemberStandardSummary & {
    dashboardPageId?: string;
    dashboardOrderIndex?: number;
  }>;
}
```

Other-member dashboard UI:

- Render the owner's page grouping when `pages` or placement fields are present.
- Fall back to the current flat grid if no page layout exists.
- Import mode can still select standards across visible pages.

Self member dashboard:

- Reuses the main dashboard behavior through `StandardsScreen`, so it should receive the same page support automatically.

## Shared Model

Update `packages/shared-model/src/types.ts` and `schemas.ts`:

- Add `dashboardPageId?: string`.
- Add `dashboardOrderIndex?: number`.
- Add dashboard layout types/schemas if shared between mobile and functions.

Run `npm run build` for `packages/shared-model` after changes.

## Tests

Add unit tests for dashboard page utilities:

- Creates virtual pages from legacy standards.
- Keeps pages at six standards each.
- Places new standards into first page with room.
- Creates a new page when all pages are full.
- Reorders within a page.
- Moves across pages and rejects/handles full target pages.
- Sanitizes missing page ids and duplicate order indexes.

Update hook/service tests:

- `useStandards` no longer rejects at six active standards.
- Dashboard layout service subscribes and saves expected Firestore paths.
- `useDashboardPages` combines standards and layout correctly.

Update screen tests:

- Dashboard swipes between pages.
- Page dots/label reflect active page.
- New standard appears on the correct page and highlights.
- Rename page writes through the hook/service.
- Other-member group dashboard honors page grouping.

Update function tests:

- `getMemberStandards` includes page metadata/placement.
- Hidden standards are still excluded from both standards and page presentation.
- `getMemberDashboard` stats remain based on all visible active standards.

## Rollout Notes

- Keep flat dashboard fallback until all users have written layouts.
- Avoid changing group stats semantics.
- Avoid deleting existing `orderIndex` immediately; use it as migration input.
- If Firestore rules are present for `preferences`, update them to allow authenticated users to read/write only their own dashboard layout.

## Implemented Manage Standards Surface

The management experience is now consolidated into `Manage Standards`, backed by the existing `StandardsLibrary` route. The route keeps picker behavior for modal selection contexts, but the normal settings/dashboard entry renders the combined management surface.

Implemented behavior:

- Active standards render grouped by dashboard page, with each page showing its name, count, and a compact overflow menu.
- Empty pages render as compact placeholders so inactive standard controls remain reachable on small simulator/device heights.
- Inactive standards render below active pages with visible activate/deactivate controls.
- Activating an inactive standard opens an explicit page picker instead of silently choosing a page.
- Active standard row menus support edit, move to page, and delete.
- Inactive standard row menus support edit, activate, and delete.
- The header create button opens a single local create menu with `New Standard` and `New Page`.
- The floating app tab bar is hidden while `Manage Standards` is focused, leaving the header create button as the only create affordance on this surface and avoiding bottom-control collisions.
- Nameless legacy/test standards display as `Untitled Standard` so rows, switches, menus, and delete prompts do not render blank labels.

Implementation files:

- `apps/mobile/src/screens/StandardsLibraryScreen.tsx`
- `apps/mobile/src/navigation/BottomTabNavigator.tsx`
- `apps/mobile/src/navigation/screenWrappers.tsx`
- `apps/mobile/src/screens/ActiveStandardsDashboardScreen.tsx`
- `apps/mobile/src/utils/dashboardPages.ts`
- `apps/mobile/src/utils/__tests__/dashboardPages.test.ts`

Simulator verification covered:

- Dashboard `Manage Standards` entry opens the combined screen.
- Header create opens `New Standard` / `New Page`.
- Page overflow exposes page actions.
- Active row overflow exposes edit / move / delete.
- Inactive row overflow exposes edit / activate / delete.
- Activation opens the page picker with page capacity labels and `Create New Page`.
- Test account data remained unchanged during verification.
