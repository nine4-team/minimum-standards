import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { BottomTabParamList, SETTINGS_TAB_ROUTE_NAME } from './types';
import { StandardsStack } from './StandardsStack';
import { ActivitiesStack } from './ActivitiesStack';
import { GroupsStack } from './GroupsStack';
import { SettingsStack } from './SettingsStack';
import { useTheme } from '../theme/useTheme';
import { useActivityHistoryEngine } from '../hooks/useActivityHistoryEngine';
import { useMigration } from '../hooks/useMigration';

const Tab = createBottomTabNavigator<BottomTabParamList>();

function EmptyScreen() {
  return <View />;
}

const NAV_ICONS: Record<string, string> = {
  Standards: 'task-alt',
  Scorecards: 'bar-chart',
  Groups: 'group',
  [SETTINGS_TAB_ROUTE_NAME]: 'settings',
};

const NAV_LABELS: Record<string, string> = {
  Standards: 'Standards tab',
  Scorecards: 'Scorecards tab',
  Groups: 'Groups tab',
  [SETTINGS_TAB_ROUTE_NAME]: 'Settings tab',
};

function CreateMenu({ navigation, theme }: { navigation: any; theme: any }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      {open && (
        <>
        <Pressable
          onPress={() => setOpen(false)}
          style={createMenuStyles.backdrop}
          accessibilityLabel="Dismiss menu"
        />
        <View
          style={[
            createMenuStyles.menu,
            { backgroundColor: theme.background.surface },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              navigation.navigate('CreateStandardFlow');
            }}
            style={createMenuStyles.menuItem}
          >
            <MaterialIcons name="task-alt" size={18} color={theme.text.primary} />
            <Text style={[createMenuStyles.menuText, { color: theme.text.primary }]}>Standard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              navigation.navigate('Groups', { screen: 'CreateGroup' });
            }}
            style={createMenuStyles.menuItem}
          >
            <MaterialIcons name="group" size={18} color={theme.text.primary} />
            <Text style={[createMenuStyles.menuText, { color: theme.text.primary }]}>Group</Text>
          </TouchableOpacity>
        </View>
        </>
      )}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Create"
        style={({ pressed }) => [
          createMenuStyles.fabOuter,
          {
            backgroundColor: theme.background.surface,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <View
          style={[
            createMenuStyles.fabInner,
            { backgroundColor: theme.button.primary.background },
          ]}
        >
          <MaterialIcons
            name={open ? 'close' : 'add'}
            size={22}
            color="#fff"
          />
        </View>
      </Pressable>
    </View>
  );
}

const createMenuStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -1000,
    bottom: -20,
    left: -1000,
    right: -1000,
  },
  menu: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    minWidth: 150,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '500',
  },
  fabOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const navRoutes = state.routes.filter((r) => r.name !== 'Create');
  const activeRouteKey = state.routes[state.index]?.key;

  const fadeColor = theme.background.screen;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      {/* Fade gradient: transparent → screen background */}
      <View pointerEvents="none" style={{ height: 32 }}>
        {[0, 0.08, 0.2, 0.4, 0.65, 0.85, 1].map((opacity, i, arr) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: fadeColor,
              opacity,
            }}
          />
        ))}
      </View>
      <View
        pointerEvents="box-none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: fadeColor,
        }}
      >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.background.surface,
          borderRadius: 26,
          paddingHorizontal: 6,
          height: 52,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {navRoutes.map((route) => {
          const isFocused = route.key === activeRouteKey;
          const iconName = NAV_ICONS[route.name] ?? 'circle';
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={NAV_LABELS[route.name]}
              accessibilityState={isFocused ? { selected: true } : {}}
              style={({ pressed }) => ({
                width: 48,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginHorizontal: 2,
                backgroundColor: isFocused ? theme.button.primary.background : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons
                name={iconName}
                size={22}
                color={isFocused ? '#fff' : '#555'}
              />
            </Pressable>
          );
        })}
      </View>

      <CreateMenu navigation={navigation} theme={theme} />
      </View>
    </View>
  );
}

export function BottomTabNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (__DEV__) {
      console.info('[BottomTabNavigator] safe area insets', insets);
    }
  }, [insets]);

  useMigration();
  useActivityHistoryEngine();

  return (
    <Tab.Navigator
      initialRouteName="Standards"
      sceneContainerStyle={{ backgroundColor: theme.background.screen }}
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Create"
        component={EmptyScreen}
        options={{ tabBarAccessibilityLabel: 'Create standard' }}
      />
      <Tab.Screen
        name="Standards"
        component={StandardsStack}
        options={{ tabBarAccessibilityLabel: 'Standards tab' }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsStack}
        options={{ tabBarAccessibilityLabel: 'Groups tab' }}
      />
      <Tab.Screen
        name="Scorecards"
        component={ActivitiesStack}
        options={{ tabBarAccessibilityLabel: 'Scorecards tab' }}
      />
      <Tab.Screen
        name={SETTINGS_TAB_ROUTE_NAME}
        component={SettingsStack}
        options={{ tabBarAccessibilityLabel: 'Settings tab' }}
      />
    </Tab.Navigator>
  );
}
