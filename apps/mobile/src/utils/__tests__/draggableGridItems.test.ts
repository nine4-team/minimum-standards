import { reconcileGridItems } from '../draggableGridItems';

type TestItem = {
  standard: {
    id: string;
  };
  progress: number;
};

const item = (id: string, progress = 0): TestItem => ({
  standard: { id },
  progress,
});

describe('draggableGridItems', () => {
  test('syncs to incoming order when the same items are reordered upstream', () => {
    const current = [item('a'), item('b'), item('c')];
    const incoming = [item('b'), item('c'), item('a')];

    expect(reconcileGridItems(current, incoming).map((entry) => entry.standard.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  test('refreshes item data when order is unchanged', () => {
    const current = [item('a', 1), item('b', 1)];
    const incoming = [item('a', 2), item('b', 3)];

    expect(reconcileGridItems(current, incoming).map((entry) => entry.progress)).toEqual([
      2,
      3,
    ]);
  });
});
