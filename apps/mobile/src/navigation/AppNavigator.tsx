import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { StandardPeriodActivityLogsScreen } from '../screens/StandardPeriodActivityLogsScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import { useSnapshotImportFlow } from '../hooks/useSnapshotImportFlow';
import { GroupJoinPrompt } from '../components/GroupJoinPrompt';
import { navigationRef } from './navigationRef';
import { useTheme } from '../theme/useTheme';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { AuthRecoveryOverlay } from '../components/AuthRecoveryOverlay';

const RootStack = createNativeStackNavigator<RootStackParamList>();

console.log('[AppNavigator] Module evaluation started');

export function AppNavigator() {
  const { user, isInitialized, status } = useAuthStore();
  useSnapshotImportFlow();
  console.log('[AppNavigator] Render start', {
    isInitialized,
    hasUser: !!user,
    userId: user?.uid,
  });

  const theme = useTheme();
  const systemColorScheme = useColorScheme();
  const themePreference = useUIPreferencesStore((state) => state.themePreference);
  const isDark = themePreference === 'system'
    ? systemColorScheme === 'dark'
    : themePreference === 'dark';

  const navigationTheme: Theme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: theme.tabBar.activeTint,
      background: theme.background.screen,
      card: theme.background.chrome,
      text: theme.text.primary,
      border: theme.border.secondary,
      notification: theme.status.missed.bar,
    },
  }), [isDark, theme]);

  // Show loading screen while auth state initializes
  if (!isInitialized) {
    console.log('[AppNavigator] Auth not initialized yet - rendering LoadingScreen');
    return <LoadingScreen />;
  }

  const destination = user ? 'MainStack' : 'AuthStack';
  console.log('[AppNavigator] Auth initialized - rendering', destination);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainStack} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStack} />
        )}
        <RootStack.Screen
          name="StandardPeriodActivityLogs"
          component={StandardPeriodActivityLogsScreen}
        />
      </RootStack.Navigator>
      <GroupJoinPrompt />
      {(status === 'recovering' || status === 'signing-out') && (
        <AuthRecoveryOverlay />
      )}
    </NavigationContainer>
  );
}
