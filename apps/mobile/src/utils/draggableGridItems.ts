export type GridItemWithStandardId = {
  standard: {
    id: string;
  };
};

export function haveSameGridItemOrder<T extends GridItemWithStandardId>(
  currentItems: T[],
  incomingItems: T[]
): boolean {
  if (currentItems.length !== incomingItems.length) return false;
  return currentItems.every(
    (item, index) => item.standard.id === incomingItems[index]?.standard.id
  );
}

export function haveSameGridItemSet<T extends GridItemWithStandardId>(
  currentItems: T[],
  incomingItems: T[]
): boolean {
  if (currentItems.length !== incomingItems.length) return false;
  const incomingIds = new Set(incomingItems.map((item) => item.standard.id));
  return currentItems.every((item) => incomingIds.has(item.standard.id));
}

export function reconcileGridItems<T extends GridItemWithStandardId>(
  currentItems: T[],
  incomingItems: T[]
): T[] {
  if (
    !haveSameGridItemSet(currentItems, incomingItems) ||
    !haveSameGridItemOrder(currentItems, incomingItems)
  ) {
    return [...incomingItems];
  }

  const incomingById = new Map(
    incomingItems.map((item) => [item.standard.id, item])
  );
  return currentItems.map(
    (item) => incomingById.get(item.standard.id) ?? item
  );
}
