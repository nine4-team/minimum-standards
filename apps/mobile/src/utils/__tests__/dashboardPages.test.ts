import type { DashboardLayoutPage, Standard } from '@minimum-standards/shared-model';
import {
  DASHBOARD_PAGE_SIZE,
  buildDashboardPages,
  buildPlacementUpdates,
  getFirstPageWithRoom,
  getVisiblePageDotIndexes,
  moveStandardToPage,
  renameDashboardPage,
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

  test('renames pages with trimmed text', () => {
    expect(renameDashboardPage(pages, 'health', ' Fitness ')[0].name).toBe(
      'Fitness'
    );
    expect(renameDashboardPage(pages, 'health', '   ')[0].name).toBe('Health');
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
