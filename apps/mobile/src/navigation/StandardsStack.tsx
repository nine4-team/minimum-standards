import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StandardsStackParamList } from './types';
import { StandardsScreenWrapper } from './screenWrappers';
import { useTheme } from '../theme/useTheme';

const Stack = createNativeStackNavigator<StandardsStackParamList>();

export function StandardsStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="ActiveStandardsDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.screen },
      }}
    >
      <Stack.Screen name="ActiveStandardsDashboard" component={StandardsScreenWrapper} />
    </Stack.Navigator>
  );
}
