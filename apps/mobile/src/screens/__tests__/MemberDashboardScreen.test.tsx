import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { MemberDashboardScreen } from '../MemberDashboardScreen';
import { firebaseAuth } from '../../firebase/firebaseApp';
import * as groupsService from '../../services/groupsService';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams = {
  groupId: 'group-1',
  memberUid: 'other-user',
  displayName: 'Avery',
};

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      goBack: mockGoBack,
      navigate: mockNavigate,
      getParent: () => ({
        getParent: () => ({
          navigate: mockNavigate,
        }),
      }),
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  };
});

jest.mock('../../services/groupsService', () => ({
  getMemberStandards: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

jest.mock('../ActiveStandardsDashboardScreen', () => ({
  StandardsScreen: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text testID="self-standards-screen">{title}</Text>;
  },
}));

jest.mock('../../hooks/useStandards', () => ({
  useStandards: () => ({
    standards: [],
  }),
}));

jest.mock('../../stores/standardsBuilderStore', () => ({
  useStandardsBuilderStore: Object.assign(
    jest.fn((selector) => selector({ reset: jest.fn() })),
    {
      getState: () => ({
        loadFromStandard: jest.fn(),
      }),
    }
  ),
}));

jest.mock('../../components/CircularStandardCard', () => ({
  CircularStandardCard: ({ activityName }: { activityName: string }) => {
    const { Text } = require('react-native');
    return <Text>{activityName}</Text>;
  },
}));

jest.mock('../../theme/useTheme', () => ({
  useTheme: () => ({
    activityIndicator: '#000',
    background: {
      screen: '#fff',
      card: '#fff',
      tertiary: '#eee',
    },
    border: {
      primary: '#ddd',
    },
    link: '#00f',
    text: {
      primary: '#111',
      secondary: '#555',
      tertiary: '#999',
    },
  }),
}));

jest.mock('@nine4/ui-kit', () => ({
  SCREEN_PADDING: 16,
  CARD_LIST_GAP: 8,
  getScreenContainerStyle: () => ({ flex: 1 }),
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');

const mockGetMemberStandards = groupsService.getMemberStandards as jest.MockedFunction<
  typeof groupsService.getMemberStandards
>;

describe('MemberDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {
      groupId: 'group-1',
      memberUid: 'other-user',
      displayName: 'Avery',
    };
    (firebaseAuth as any).currentUser = { uid: 'current-user' };
    mockGetMemberStandards.mockResolvedValue({ standards: [] });
  });

  it('uses the full standards experience when viewing yourself inside a group', () => {
    mockRouteParams = {
      groupId: 'group-1',
      memberUid: 'current-user',
      displayName: 'Ben',
    };

    const { getByTestId, getByText } = render(<MemberDashboardScreen />);

    expect(getByTestId('self-standards-screen')).toBeTruthy();
    expect(getByText("Ben's Standards")).toBeTruthy();
    expect(mockGetMemberStandards).not.toHaveBeenCalled();
  });

  it('keeps the service-backed read-only view for other group members', async () => {
    render(<MemberDashboardScreen />);

    await waitFor(() => {
      expect(mockGetMemberStandards).toHaveBeenCalledWith('group-1', 'other-user');
    });
  });
});
