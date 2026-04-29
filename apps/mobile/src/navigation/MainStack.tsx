import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from './types';
import { BottomTabNavigator } from './BottomTabNavigator';
import { CreateStandardFlow } from './CreateStandardFlow';
import { EditStandardScreen } from '../screens/EditStandardScreen';
import { SuggestorFlow } from './SuggestorFlow';
import { useTheme } from '../theme/useTheme';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.screen },
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="CreateStandardFlow"
        component={CreateStandardFlow}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="EditStandard"
        component={EditStandardScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      {/* Suggestor disabled — feature cut for now
      <Stack.Screen
        name="SuggestorFlow"
        component={SuggestorFlow}
        options={{ presentation: 'fullScreenModal' }}
      />
      */}
    </Stack.Navigator>
  );
}

// Add testID for testing purposes
MainStack.displayName = 'MainStack';
