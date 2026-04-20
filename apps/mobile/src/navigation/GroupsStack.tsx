import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupsStackParamList } from './types';
import { GroupsListScreen } from '../screens/GroupsListScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { MemberDashboardScreen } from '../screens/MemberDashboardScreen';
import { MemberStandardDetailScreen } from '../screens/MemberStandardDetailScreen';
import { useTheme } from '../theme/useTheme';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export function GroupsStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="GroupsList"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.screen },
      }}
    >
      <Stack.Screen name="GroupsList" component={GroupsListScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="MemberDashboard" component={MemberDashboardScreen} />
      <Stack.Screen name="MemberStandardDetail" component={MemberStandardDetailScreen} />
    </Stack.Navigator>
  );
}
