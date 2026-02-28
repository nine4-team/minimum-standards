import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScorecardStackParamList } from './types';
import { ScorecardSummaryScreenWrapper, ScorecardDetailScreenWrapper } from './screenWrappers';
import { useTheme } from '../theme/useTheme';

const Stack = createNativeStackNavigator<ScorecardStackParamList>();

export function ActivitiesStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="ScorecardSummary"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.screen },
      }}
    >
      <Stack.Screen name="ScorecardSummary" component={ScorecardSummaryScreenWrapper} />
      <Stack.Screen name="ScorecardDetail" component={ScorecardDetailScreenWrapper} />
    </Stack.Navigator>
  );
}
