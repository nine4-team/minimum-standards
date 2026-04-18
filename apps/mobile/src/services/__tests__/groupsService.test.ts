import * as groupsService from '../groupsService';
import * as cloudFunctions from '../cloudFunctions';

jest.mock('../cloudFunctions');
const mockCallFunction = cloudFunctions.callFunction as jest.MockedFunction<typeof cloudFunctions.callFunction>;

beforeEach(() => {
  mockCallFunction.mockReset();
});

// ---------------------------------------------------------------------------
// createGroup
// ---------------------------------------------------------------------------

describe('createGroup', () => {
  it('calls createGroup with correct args and returns result', async () => {
    mockCallFunction.mockResolvedValue({ groupId: 'g1', inviteCode: 'ABCD1234' });
    const result = await groupsService.createGroup('Morning Crew', 'Ben');
    expect(mockCallFunction).toHaveBeenCalledWith('createGroup', {
      name: 'Morning Crew',
      displayName: 'Ben',
    });
    expect(result).toEqual({ groupId: 'g1', inviteCode: 'ABCD1234' });
  });

  it('maps errors to user-facing message', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error('err'), { code: 'functions/unavailable' })
    );
    await expect(groupsService.createGroup('x', 'y')).rejects.toThrow(
      'Cloud Functions not available'
    );
  });
});

// ---------------------------------------------------------------------------
// joinGroup
// ---------------------------------------------------------------------------

describe('joinGroup', () => {
  it('calls joinGroup with correct args', async () => {
    mockCallFunction.mockResolvedValue({ groupId: 'g2' });
    const result = await groupsService.joinGroup('ABCD1234', 'Sara');
    expect(mockCallFunction).toHaveBeenCalledWith('joinGroup', {
      inviteCode: 'ABCD1234',
      displayName: 'Sara',
    });
    expect(result).toEqual({ groupId: 'g2' });
  });

  it('maps not-found to "Invalid invite code."', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/not-found' })
    );
    await expect(groupsService.joinGroup('BAD', 'x')).rejects.toThrow('Invalid invite code.');
  });

  it('maps resource-exhausted to "This group is full."', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/resource-exhausted' })
    );
    await expect(groupsService.joinGroup('FULL', 'x')).rejects.toThrow('This group is full.');
  });

  it('maps already-exists to "You are already in this group."', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/already-exists' })
    );
    await expect(groupsService.joinGroup('DUP', 'x')).rejects.toThrow('already in this group');
  });
});

// ---------------------------------------------------------------------------
// leaveGroup
// ---------------------------------------------------------------------------

describe('leaveGroup', () => {
  it('calls leaveGroup and returns result', async () => {
    mockCallFunction.mockResolvedValue({ deleted: false });
    const result = await groupsService.leaveGroup('g1');
    expect(mockCallFunction).toHaveBeenCalledWith('leaveGroup', { groupId: 'g1' });
    expect(result).toEqual({ deleted: false });
  });
});

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

describe('removeMember', () => {
  it('calls removeMember with correct args', async () => {
    mockCallFunction.mockResolvedValue({ success: true });
    await groupsService.removeMember('g1', 'uid2');
    expect(mockCallFunction).toHaveBeenCalledWith('removeMember', {
      groupId: 'g1',
      targetUid: 'uid2',
    });
  });
});

// ---------------------------------------------------------------------------
// transferAdmin
// ---------------------------------------------------------------------------

describe('transferAdmin', () => {
  it('calls transferAdmin with correct args', async () => {
    mockCallFunction.mockResolvedValue({ success: true });
    await groupsService.transferAdmin('g1', 'uid3');
    expect(mockCallFunction).toHaveBeenCalledWith('transferAdmin', {
      groupId: 'g1',
      newAdminUid: 'uid3',
    });
  });
});

// ---------------------------------------------------------------------------
// getMemberDashboard
// ---------------------------------------------------------------------------

describe('getMemberDashboard', () => {
  it('returns dashboard data on success', async () => {
    const mockData = {
      groupId: 'g1',
      groupName: 'Test',
      inviteCode: 'ABCD1234',
      adminUid: 'uid1',
      members: [],
    };
    mockCallFunction.mockResolvedValue(mockData);
    const result = await groupsService.getMemberDashboard('g1');
    expect(result).toEqual(mockData);
  });

  it('maps not-found error', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/not-found' })
    );
    await expect(groupsService.getMemberDashboard('bad')).rejects.toThrow('Group not found.');
  });

  it('maps permission-denied error', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/permission-denied' })
    );
    await expect(groupsService.getMemberDashboard('g1')).rejects.toThrow('not a member');
  });
});

// ---------------------------------------------------------------------------
// getMemberStandardDetail
// ---------------------------------------------------------------------------

describe('getMemberStandardDetail', () => {
  it('returns standard detail on success', async () => {
    const mockData = {
      standard: { id: 's1', name: 'Running' },
      history: [],
    };
    mockCallFunction.mockResolvedValue(mockData);
    const result = await groupsService.getMemberStandardDetail('g1', 'uid1', 's1');
    expect(result).toEqual(mockData);
  });

  it('maps permission-denied to hidden message', async () => {
    mockCallFunction.mockRejectedValue(
      Object.assign(new Error(''), { code: 'functions/permission-denied' })
    );
    await expect(
      groupsService.getMemberStandardDetail('g1', 'uid1', 's1')
    ).rejects.toThrow('hidden from the group');
  });
});

// ---------------------------------------------------------------------------
// updateDisplayName
// ---------------------------------------------------------------------------

describe('updateDisplayName', () => {
  it('calls updateDisplayName with correct args', async () => {
    mockCallFunction.mockResolvedValue({ success: true });
    await groupsService.updateDisplayName('New Name');
    expect(mockCallFunction).toHaveBeenCalledWith('updateDisplayName', {
      displayName: 'New Name',
    });
  });
});
