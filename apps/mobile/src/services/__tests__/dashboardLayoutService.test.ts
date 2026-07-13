import {
  saveDashboardLayoutAndPlacements,
  subscribeToDashboardLayout,
} from '../dashboardLayoutService';

const mockOnSnapshot = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
  onSnapshot: mockOnSnapshot,
  set: mockSet,
  update: mockUpdate,
}));
const mockCollection = jest.fn(() => ({}));
const mockServerTimestamp = jest.fn(() => ({ _methodName: 'serverTimestamp' }));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  collection: () => mockCollection(),
  doc: () => mockDoc(),
  serverTimestamp: () => mockServerTimestamp(),
}));

jest.mock('../../firebase/firebaseApp', () => ({
  firebaseFirestore: {
    batch: () => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockCommit,
    }),
  },
}));

describe('dashboardLayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSnapshot.mockReturnValue(jest.fn());
    mockCommit.mockResolvedValue(undefined);
  });

  test('emits null for a missing layout document with method-style exists', () => {
    mockOnSnapshot.mockImplementation((onNext) => {
      onNext({
        exists: () => false,
        data: () => undefined,
      });
      return jest.fn();
    });

    const onNext = jest.fn();
    const onError = jest.fn();

    subscribeToDashboardLayout('user-1', onNext, onError);

    expect(onNext).toHaveBeenCalledWith(null);
    expect(onError).not.toHaveBeenCalled();
  });

  test('emits null when an existing snapshot has no data payload', () => {
    mockOnSnapshot.mockImplementation((onNext) => {
      onNext({
        exists: true,
        data: () => undefined,
      });
      return jest.fn();
    });

    const onNext = jest.fn();
    const onError = jest.fn();

    subscribeToDashboardLayout('user-1', onNext, onError);

    expect(onNext).toHaveBeenCalledWith(null);
    expect(onError).not.toHaveBeenCalled();
  });

  test('saves layout and only the provided standard placements', async () => {
    await saveDashboardLayoutAndPlacements(
      'user-1',
      [{ id: 'page-1', name: 'Page 1', orderIndex: 0 }],
      [{ standardId: 'new-standard', dashboardPageId: 'page-1', dashboardOrderIndex: 0 }]
    );

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(expect.any(Object), {
      dashboardPageId: 'page-1',
      dashboardOrderIndex: 0,
      updatedAt: { _methodName: 'serverTimestamp' },
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });
});
