import { subscribeToDashboardLayout } from '../dashboardLayoutService';

const mockOnSnapshot = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockCommit = jest.fn();
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
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

jest.mock('../../firebase/firebaseApp', () => ({
  firebaseFirestore: {
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockCommit,
    }),
  },
}));

describe('dashboardLayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSnapshot.mockReturnValue(jest.fn());
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
});
