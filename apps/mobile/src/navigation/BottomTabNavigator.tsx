import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { BottomTabParamList, SETTINGS_TAB_ROUTE_NAME } from './types';
import { StandardsStack } from './StandardsStack';
import { ActivitiesStack } from './ActivitiesStack';
import { SettingsStack } from './SettingsStack';
import { useTheme } from '../theme/useTheme';
import { useActivityHistoryEngine } from '../hooks/useActivityHistoryEngine';
import { useMigration } from '../hooks/useMigration';
import { getTabBarStyle } from '@nine4/ui-kit';

const Tab = createBottomTabNavigator<BottomTabParamList>();

// Placeholder component for the Create tab (never actually renders)
function EmptyScreen() {
  return <View />;
}

export function BottomTabNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (__DEV__) {
      console.info('[BottomTabNavigator] safe area insets', insets);
    }
  }, [insets]);

  // Run one-time data migration (activities → standards)
  useMigration();

  // Mount the Activity History Engine once at the authenticated app root
  // This ensures it runs for the whole session and avoids duplicate timers
  useActivityHistoryEngine();

  const baseTabBarStyle = getTabBarStyle(theme, insets);
  const bottomPadding = 16;
  const compactHeight = 49 + bottomPadding;
  const tabBarStyle = {
    ...baseTabBarStyle,
    paddingBottom: bottomPadding,
    height: compactHeight,
    minHeight: compactHeight,
  };

  return (
    <Tab.Navigator
      initialRouteName="Standards"
      sceneContainerStyle={{ backgroundColor: theme.background.screen }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabBar.activeTint,
        tabBarInactiveTintColor: theme.tabBar.inactiveTint,
        tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Create"
        component={EmptyScreen}
        options={({ navigation }) => ({
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarAccessibilityLabel: 'Create standard',
          tabBarButton: () => (
            <Pressable
              onPress={() => navigation.navigate('CreateStandardFlow')}
              accessibilityRole="button"
              accessibilityLabel="Create standard"
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: theme.button.primary.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="add" size={22} color={theme.tabBar.inactiveTint} />
              </View>
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name="Standards"
        component={StandardsStack}
        options={{
          tabBarLabel: 'Standards',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="pending-actions" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Standards tab',
        }}
      />
      <Tab.Screen
        name="Scorecards"
        component={ActivitiesStack}
        options={{
          tabBarLabel: 'Scorecards',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assessment" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Scorecards tab',
        }}
      />
      <Tab.Screen
        name={SETTINGS_TAB_ROUTE_NAME}
        component={SettingsStack}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}
