import type { DashboardLayoutPage, Standard } from '@minimum-standards/shared-model';

export const DASHBOARD_PAGE_SIZE = 6;

export type DashboardStandardLike = {
  id: string;
  name: string;
  orderIndex?: number;
  dashboardPageId?: string;
  dashboardOrderIndex?: number;
};

export type DashboardLayoutInput = {
  pages: DashboardLayoutPage[];
  pageSize?: number;
} | null;

export type DashboardPage<T extends DashboardStandardLike = Standard> = {
  id: string;
  name: string;
  orderIndex: number;
  standards: T[];
};

export type DashboardPlacement = {
  standardId: string;
  dashboardPageId: string;
  dashboardOrderIndex: number;
};

function compareLegacyStandards<T extends DashboardStandardLike>(a: T, b: T): number {
  const aIdx = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const bIdx = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
  if (aIdx !== bIdx) return aIdx - bIdx;
  return a.name.localeCompare(b.name);
}

function compareDashboardStandards<T extends DashboardStandardLike>(a: T, b: T): number {
  const aIdx = a.dashboardOrderIndex ?? Number.MAX_SAFE_INTEGER;
  const bIdx = b.dashboardOrderIndex ?? Number.MAX_SAFE_INTEGER;
  if (aIdx !== bIdx) return aIdx - bIdx;
  return compareLegacyStandards(a, b);
}

export function createDefaultPage(index: number): DashboardLayoutPage {
  return {
    id: `page-${index + 1}`,
    name: `Page ${index + 1}`,
    orderIndex: index,
  };
}

export function buildDashboardPages<T extends DashboardStandardLike>(
  standards: T[],
  layout: DashboardLayoutInput,
  pageSize: number = DASHBOARD_PAGE_SIZE
): DashboardPage<T>[] {
  const sortedLayoutPages = [...(layout?.pages ?? [])].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  if (standards.length === 0) {
    return sortedLayoutPages.length > 0
      ? sortedLayoutPages.map((page) => ({ ...page, standards: [] }))
      : [{ ...createDefaultPage(0), standards: [] }];
  }

  if (sortedLayoutPages.length === 0) {
    const legacyOrdered = [...standards].sort(compareLegacyStandards);
    const pageCount = Math.max(1, Math.ceil(legacyOrdered.length / pageSize));
    return Array.from({ length: pageCount }, (_, index) => {
      const page = createDefaultPage(index);
      return {
        ...page,
        standards: legacyOrdered.slice(index * pageSize, (index + 1) * pageSize),
      };
    });
  }

  const pageById = new Map(
    sortedLayoutPages.map((page) => [
      page.id,
      { ...page, standards: [] as T[] },
    ])
  );
  const fallbackPage = {
    id: 'uncategorized',
    name: 'Uncategorized',
    orderIndex: sortedLayoutPages.length,
    standards: [] as T[],
  };

  const unplacedStandards: T[] = [];
  standards.forEach((standard) => {
    const page =
      standard.dashboardPageId && pageById.get(standard.dashboardPageId);
    if (page) {
      page.standards.push(standard);
    } else {
      unplacedStandards.push(standard);
    }
  });

  const pages = Array.from(pageById.values()).map((page) => ({
    ...page,
    standards: [...page.standards].sort(compareDashboardStandards),
  }));

  unplacedStandards.sort(compareLegacyStandards).forEach((standard) => {
    const pageWithRoom = pages.find((page) => page.standards.length < pageSize);
    if (pageWithRoom) {
      pageWithRoom.standards.push(standard);
    } else {
      fallbackPage.standards.push(standard);
    }
  });

  if (fallbackPage.standards.length > 0) {
    fallbackPage.standards.sort(compareLegacyStandards);
    pages.push(fallbackPage);
  }

  return pages.length > 0 ? pages : [{ ...createDefaultPage(0), standards: [] }];
}

export function getFirstPageWithRoom(
  pages: DashboardPage[],
  pageSize: number = DASHBOARD_PAGE_SIZE
): DashboardPage | null {
  return pages.find((page) => page.standards.length < pageSize) ?? null;
}

export function createNextPage(pages: DashboardPage[]): DashboardLayoutPage {
  const orderIndex = pages.length;
  return {
    id: `page-${Date.now()}-${orderIndex + 1}`,
    name: `Page ${orderIndex + 1}`,
    orderIndex,
  };
}

export function buildPlacementUpdates<T extends DashboardStandardLike>(
  pages: DashboardPage<T>[]
): DashboardPlacement[] {
  return pages.flatMap((page) =>
    page.standards.map((standard, index) => ({
      standardId: standard.id,
      dashboardPageId: page.id,
      dashboardOrderIndex: index,
    }))
  );
}

export function reorderPageStandards<T extends DashboardStandardLike>(
  pages: DashboardPage<T>[],
  pageId: string,
  orderedStandardIds: string[]
): DashboardPage<T>[] {
  const orderMap = new Map(
    orderedStandardIds.map((standardId, index) => [standardId, index])
  );

  return pages.map((page) => {
    if (page.id !== pageId) return page;
    return {
      ...page,
      standards: [...page.standards].sort((a, b) => {
        const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return compareDashboardStandards(a, b);
      }),
    };
  });
}

export function moveStandardToPage<T extends DashboardStandardLike>(
  pages: DashboardPage<T>[],
  standardId: string,
  targetPageId: string,
  pageSize: number = DASHBOARD_PAGE_SIZE
): { pages: DashboardPage<T>[]; error: string | null } {
  const sourcePage = pages.find((page) =>
    page.standards.some((standard) => standard.id === standardId)
  );
  const targetPage = pages.find((page) => page.id === targetPageId);

  if (!sourcePage || !targetPage) {
    return { pages, error: 'Page not found.' };
  }
  if (sourcePage.id === targetPage.id) {
    return { pages, error: null };
  }
  if (targetPage.standards.length >= pageSize) {
    return { pages, error: 'That page is full.' };
  }

  const movingStandard = sourcePage.standards.find(
    (standard) => standard.id === standardId
  );
  if (!movingStandard) {
    return { pages, error: 'Standard not found.' };
  }

  return {
    error: null,
    pages: pages.map((page) => {
      if (page.id === sourcePage.id) {
        return {
          ...page,
          standards: page.standards.filter((standard) => standard.id !== standardId),
        };
      }
      if (page.id === targetPage.id) {
        return {
          ...page,
          standards: [...page.standards, movingStandard],
        };
      }
      return page;
    }),
  };
}

export function renameDashboardPage(
  pages: DashboardLayoutPage[],
  pageId: string,
  name: string
): DashboardLayoutPage[] {
  const trimmed = name.trim();
  if (!trimmed) return pages;
  return pages.map((page) =>
    page.id === pageId ? { ...page, name: trimmed.slice(0, 40) } : page
  );
}
