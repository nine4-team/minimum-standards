import type { DashboardLayoutPage, Standard } from '@minimum-standards/shared-model';
import {
  DASHBOARD_PAGE_SIZE,
  addDashboardDraftPage,
  areDashboardPagesEquivalent,
  buildDashboardPages,
  buildNewStandardDashboardPlacement,
  buildPlacementUpdates,
  deleteEmptyDashboardDraftPage,
  getFirstPageWithRoom,
  getVisiblePageDotIndexes,
  moveStandardInDashboardPages,
  moveStandardToPage,
  renameDashboardDraftPage,
  renameDashboardPage,
  reorderDashboardDraftPage,
  reorderPageStandards,
} from '../dashboardPages';

const makeStandard = (overrides: Partial<Standard>): Standard => ({
  id: 'standard',
  name: 'Standard',
  minimum: 1,
  unit: 'calls',
  cadence: { interval: 1, unit: 'week' },
  state: 'active',
  summary: '1 call / week',
  archivedAtMs: null,
  createdAtMs: 1,
  updatedAtMs: 1,
  deletedAtMs: null,
  sessionConfig: {
    sessionLabel: 'session',
    sessionsPerCadence: 1,
    volumePerSession: 1,
  },
  notes: null,
  ...overrides,
});

const makeStandards = (count: number): Standard[] =>
  Array.from({ length: count }, (_, index) =>
    makeStandard({
      id: `s${index + 1}`,
      name: `Standard ${index + 1}`,
      orderIndex: index,
    })
  );

const pages: DashboardLayoutPage[] = [
  { id: 'health', name: 'Health', orderIndex: 0 },
  { id: 'work', name: 'Work', orderIndex: 1 },
];

describe('dashboardPages', () => {
  test('creates virtual pages from legacy standards in chunks of six', () => {
    const result = buildDashboardPages(makeStandards(7), null);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Page 1');
    expect(result[0].standards.map((standard) => standard.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
    expect(result[1].standards.map((standard) => standard.id)).toEqual(['s7']);
  });

  test('uses synced page placement when present', () => {
    const standards = [
      makeStandard({
        id: 'walk',
        name: 'Walk',
        dashboardPageId: 'health',
        dashboardOrderIndex: 1,
      }),
      makeStandard({
        id: 'sleep',
        name: 'Sleep',
        dashboardPageId: 'health',
        dashboardOrderIndex: 0,
      }),
      makeStandard({
        id: 'prospect',
        name: 'Prospect',
        dashboardPageId: 'work',
        dashboardOrderIndex: 0,
      }),
    ];

    const result = buildDashboardPages(standards, { pages });

    expect(result.map((page) => page.name)).toEqual(['Health', 'Work']);
    expect(result[0].standards.map((standard) => standard.id)).toEqual([
      'sleep',
      'walk',
    ]);
    expect(result[1].standards.map((standard) => standard.id)).toEqual([
      'prospect',
    ]);
  });

  test('honors synced layout pages before standards have placements', () => {
    const result = buildDashboardPages(makeStandards(4), { pages });

    expect(result.map((page) => page.name)).toEqual(['Health', 'Work']);
    expect(result[0].standards.map((standard) => standard.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
    ]);
    expect(result[1].standards).toEqual([]);
  });

  test('keeps empty synced layout pages visible when there are no standards', () => {
    const result = buildDashboardPages([], { pages });

    expect(result.map((page) => page.name)).toEqual(['Health', 'Work']);
    expect(result[0].standards).toEqual([]);
    expect(result[1].standards).toEqual([]);
  });

  test('builds owner layout pages for group member standard summaries', () => {
    const memberStandards = [
      {
        id: 'calls',
        name: 'Calls',
        dashboardPageId: 'work',
        dashboardOrderIndex: 0,
      },
      {
        id: 'sleep',
        name: 'Sleep',
        dashboardPageId: 'health',
        dashboardOrderIndex: 0,
      },
    ];

    const result = buildDashboardPages(memberStandards, { pages });

    expect(result.map((page) => page.name)).toEqual(['Health', 'Work']);
    expect(result[0].standards.map((standard) => standard.id)).toEqual(['sleep']);
    expect(result[1].standards.map((standard) => standard.id)).toEqual(['calls']);
  });

  test('finds first page with room', () => {
    const result = buildDashboardPages(makeStandards(7), null);

    expect(getFirstPageWithRoom(result)?.id).toBe('page-2');
    expect(getFirstPageWithRoom(result, 1)).toBeNull();
  });

  test('reorders standards within one page', () => {
    const result = buildDashboardPages(makeStandards(3), null);
    const reordered = reorderPageStandards(result, 'page-1', ['s3', 's1', 's2']);

    expect(reordered[0].standards.map((standard) => standard.id)).toEqual([
      's3',
      's1',
      's2',
    ]);
  });

  test('blocks moving standards into a full page', () => {
    const standards = makeStandards(7).map((standard, index) => ({
      ...standard,
      dashboardPageId: index < DASHBOARD_PAGE_SIZE ? 'health' : 'work',
      dashboardOrderIndex:
        index < DASHBOARD_PAGE_SIZE ? index : index - DASHBOARD_PAGE_SIZE,
    }));
    const result = buildDashboardPages(standards, { pages });
    const moved = moveStandardToPage(result, 's7', 'health');

    expect(moved.error).toBe('That page is full.');
    expect(moved.pages[0].standards.map((standard) => standard.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
  });

  test('moves standards to a page with room and builds placement updates', () => {
    const standards = [
      makeStandard({
        id: 'sleep',
        name: 'Sleep',
        dashboardPageId: 'health',
        dashboardOrderIndex: 0,
      }),
      makeStandard({
        id: 'prospect',
        name: 'Prospect',
        dashboardPageId: 'work',
        dashboardOrderIndex: 0,
      }),
    ];
    const result = buildDashboardPages(standards, { pages });
    const moved = moveStandardToPage(result, 'prospect', 'health');

    expect(moved.error).toBeNull();
    expect(moved.pages[0].standards.map((standard) => standard.id)).toEqual([
      'sleep',
      'prospect',
    ]);
    expect(buildPlacementUpdates(moved.pages)).toEqual([
      { standardId: 'sleep', dashboardPageId: 'health', dashboardOrderIndex: 0 },
      { standardId: 'prospect', dashboardPageId: 'health', dashboardOrderIndex: 1 },
    ]);
  });

  test('builds only the new standard placement when adding to an existing page', () => {
    const standards = makeStandards(2);
    const newStandard = makeStandard({
      id: 'new-standard',
      name: 'New Standard',
    });

    const result = buildNewStandardDashboardPlacement(
      standards,
      null,
      newStandard
    );

    expect(result.layoutPages).toEqual([{ id: 'page-1', name: 'Page 1', orderIndex: 0 }]);
    expect(result.placement).toEqual({
      standardId: 'new-standard',
      dashboardPageId: 'page-1',
      dashboardOrderIndex: 2,
    });
    expect(result.pages[0].standards.map((standard) => standard.id)).toEqual([
      's1',
      's2',
      'new-standard',
    ]);
  });

  test('creates a new page placement when existing dashboard pages are full', () => {
    const standards = makeStandards(DASHBOARD_PAGE_SIZE);
    const newStandard = makeStandard({
      id: 'new-standard',
      name: 'New Standard',
    });

    const result = buildNewStandardDashboardPlacement(
      standards,
      null,
      newStandard
    );

    expect(result.layoutPages).toHaveLength(2);
    expect(result.layoutPages[1].name).toBe('Page 2');
    expect(result.placement).toEqual({
      standardId: 'new-standard',
      dashboardPageId: result.layoutPages[1].id,
      dashboardOrderIndex: 0,
    });
  });

  test('moves standards between draft pages at a target index', () => {
    const standards = [
      makeStandard({
        id: 'sleep',
        name: 'Sleep',
        dashboardPageId: 'health',
        dashboardOrderIndex: 0,
      }),
      makeStandard({
        id: 'walk',
        name: 'Walk',
        dashboardPageId: 'health',
        dashboardOrderIndex: 1,
      }),
      makeStandard({
        id: 'prospect',
        name: 'Prospect',
        dashboardPageId: 'work',
        dashboardOrderIndex: 0,
      }),
    ];
    const result = buildDashboardPages(standards, { pages });
    const moved = moveStandardInDashboardPages(result, 'prospect', 'health', 1);

    expect(moved.error).toBeNull();
    expect(moved.pages[0].standards.map((standard) => standard.id)).toEqual([
      'sleep',
      'prospect',
      'walk',
    ]);
    expect(moved.pages[1].standards).toEqual([]);
  });

  test('compares dashboard pages by visible page structure and standard ids', () => {
    const result = buildDashboardPages(makeStandards(2), { pages });
    const sameVisibleStructure = result.map((page) => ({
      ...page,
      standards: page.standards.map((standard) => ({
        ...standard,
        name: `${standard.name} updated`,
        updatedAtMs: standard.updatedAtMs + 100,
      })),
    }));

    expect(areDashboardPagesEquivalent(result, sameVisibleStructure)).toBe(true);
  });

  test('detects dashboard page ordering differences', () => {
    const result = buildDashboardPages(makeStandards(3), null);
    const moved = moveStandardInDashboardPages(result, 's1', 'page-1', 2);

    expect(moved.error).toBeNull();
    expect(areDashboardPagesEquivalent(result, moved.pages)).toBe(false);
  });

  test('reorders standards within draft pages', () => {
    const result = buildDashboardPages(makeStandards(3), null);
    const moved = moveStandardInDashboardPages(result, 's1', 'page-1', 2);

    expect(moved.error).toBeNull();
    expect(moved.pages[0].standards.map((standard) => standard.id)).toEqual([
      's2',
      's3',
      's1',
    ]);
  });

  test('renames pages with trimmed text', () => {
    expect(renameDashboardPage(pages, 'health', ' Fitness ')[0].name).toBe(
      'Fitness'
    );
    expect(renameDashboardPage(pages, 'health', '   ')[0].name).toBe('Health');
  });

  test('renames draft pages without changing standards', () => {
    const result = buildDashboardPages(makeStandards(2), { pages });
    const renamed = renameDashboardDraftPage(result, 'health', ' Fitness ');

    expect(renamed[0].name).toBe('Fitness');
    expect(renamed[0].standards.map((standard) => standard.id)).toEqual([
      's1',
      's2',
    ]);
  });

  test('adds draft pages locally', () => {
    const result = buildDashboardPages(makeStandards(1), { pages });
    const added = addDashboardDraftPage(result, () => ({
      id: 'new-page',
      name: 'Page 3',
      orderIndex: 2,
    }));

    expect(added.map((page) => page.id)).toEqual(['health', 'work', 'new-page']);
    expect(added[2].standards).toEqual([]);
  });

  test('deletes only empty draft pages', () => {
    const result = addDashboardDraftPage(buildDashboardPages(makeStandards(1), { pages }), () => ({
      id: 'empty',
      name: 'Empty',
      orderIndex: 2,
    }));

    expect(deleteEmptyDashboardDraftPage(result, 'health').error).toBe(
      'Only empty pages can be deleted.'
    );
    const deleted = deleteEmptyDashboardDraftPage(result, 'empty');
    expect(deleted.error).toBeNull();
    expect(deleted.pages.map((page) => page.id)).toEqual(['health', 'work']);
  });

  test('reorders draft pages and normalizes order indexes', () => {
    const result = addDashboardDraftPage(buildDashboardPages(makeStandards(1), { pages }), () => ({
      id: 'new-page',
      name: 'Page 3',
      orderIndex: 2,
    }));

    const reordered = reorderDashboardDraftPage(result, 'new-page', -1);
    expect(reordered.map((page) => [page.id, page.orderIndex])).toEqual([
      ['health', 0],
      ['new-page', 1],
      ['work', 2],
    ]);
  });

  test('returns all page dots when page count is within the visible cap', () => {
    expect(getVisiblePageDotIndexes(4, 2)).toEqual([0, 1, 2, 3]);
  });

  test('limits visible page dots to a moving window of four', () => {
    expect(getVisiblePageDotIndexes(8, 0)).toEqual([0, 1, 2, 3]);
    expect(getVisiblePageDotIndexes(8, 4)).toEqual([3, 4, 5, 6]);
    expect(getVisiblePageDotIndexes(8, 7)).toEqual([4, 5, 6, 7]);
  });

  test('clamps visible page dots when active page index is out of range', () => {
    expect(getVisiblePageDotIndexes(6, 99)).toEqual([2, 3, 4, 5]);
    expect(getVisiblePageDotIndexes(6, -4)).toEqual([0, 1, 2, 3]);
  });
});
