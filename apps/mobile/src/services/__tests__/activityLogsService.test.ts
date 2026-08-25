import {
  ActivityLogsServiceDependencies,
  createActivityLogsService,
} from '../activityLogsService';
import { FirestoreError } from '../../utils/errors';

function makeDependencies(
  overrides: Partial<ActivityLogsServiceDependencies> = {}
): ActivityLogsServiceDependencies {
  return {
    getCurrentUserId: () => 'user-1',
    createDocumentId: () => 'log-1',
    setDocument: jest.fn().mockResolvedValue(undefined),
    updateDocument: jest.fn().mockResolvedValue(undefined),
    getDocumentFromServer: jest.fn().mockResolvedValue({
      exists: false,
      data: () => undefined,
    }),
    fromMillis: (value) => ({ toMillis: () => value }),
    serverTimestamp: () => ({ serverTimestamp: true }),
    ...overrides,
  };
}

const write = {
  id: 'log-1',
  userId: 'user-1',
  standardId: 'standard-1',
  value: 6,
  occurredAtMs: 1234,
  note: null,
};

describe('activityLogsService', () => {
  it('submits create exactly once with immutable creation fields', async () => {
    const dependencies = makeDependencies();
    const service = createActivityLogsService(dependencies);

    await service.createOnce(write);

    expect(dependencies.setDocument).toHaveBeenCalledTimes(1);
    expect(dependencies.setDocument).toHaveBeenCalledWith(
      'user-1',
      'log-1',
      expect.objectContaining({
        standardId: 'standard-1',
        value: 6,
        createdAt: { serverTimestamp: true },
        deletedAt: null,
      })
    );
  });

  it('does not put createdAt in an update', async () => {
    const dependencies = makeDependencies();
    const service = createActivityLogsService(dependencies);

    await service.update(write);

    const update = (dependencies.updateDocument as jest.Mock).mock.calls[0][2];
    expect(update).not.toHaveProperty('createdAt');
    expect(update).toHaveProperty('editedAt');
  });

  it('uses a server read and returns confirmed absence', async () => {
    const dependencies = makeDependencies();
    const service = createActivityLogsService(dependencies);

    await expect(
      service.getFromServer({ userId: 'user-1', logEntryId: 'log-1' })
    ).resolves.toBeNull();
    expect(dependencies.getDocumentFromServer).toHaveBeenCalledWith('user-1', 'log-1');
  });

  it('normalizes native Firestore errors at the boundary', async () => {
    const dependencies = makeDependencies({
      setDocument: jest.fn().mockRejectedValue({
        code: 'firestore/permission-denied',
        message: 'native details',
      }),
    });
    const service = createActivityLogsService(dependencies);

    await expect(service.createOnce(write)).rejects.toBeInstanceOf(FirestoreError);
    await expect(service.createOnce(write)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
    });
    expect(dependencies.setDocument).toHaveBeenCalledTimes(2);
  });

  it('refuses a missing or mismatched current Firebase user before I/O', async () => {
    const dependencies = makeDependencies({ getCurrentUserId: () => 'user-2' });
    const service = createActivityLogsService(dependencies);

    await expect(service.createOnce(write)).rejects.toMatchObject({
      code: 'firestore/unauthenticated',
    });
    expect(dependencies.setDocument).not.toHaveBeenCalled();
  });
});
