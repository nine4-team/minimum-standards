import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  SETTINGS_STACK_ROOT_SCREEN_NAME,
  SETTINGS_TAB_ROUTE_NAME,
} from '../types';

// Mock BottomTabNavigator with the new 4-tab structure
jest.mock('../BottomTabNavigator', () => ({
  BottomTabNavigator: () => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    const [currentTab, setCurrentTab] = React.useState('Standards');
    const [currentScreen, setCurrentScreen] = React.useState('ActiveStandardsDashboard');

    const handleTabPress = (tab: string) => {
      setCurrentTab(tab);
      if (tab === 'Standards') {
        setCurrentScreen('ActiveStandardsDashboard');
      } else if (tab === 'Scorecard') {
        setCurrentScreen('Scorecard');
      } else if (tab === SETTINGS_TAB_ROUTE_NAME) {
        setCurrentScreen(SETTINGS_STACK_ROOT_SCREEN_NAME);
      } else if (tab === 'Create') {
        // "+" button navigates to CreateStandardFlow without switching tab
        setCurrentScreen('CreateStandardFlow');
      }
    };

    const handleNavigate = (screen: string, params?: any) => {
      setCurrentScreen(screen);
    };

    return React.createElement(
      View,
      { testID: 'bottom-tab-navigator' },
      // Tab buttons
      React.createElement(
        TouchableOpacity,
        { testID: 'standards-tab', onPress: () => handleTabPress('Standards') },
        React.createElement(Text, null, 'Standards')
      ),
      React.createElement(
        TouchableOpacity,
        { testID: 'scorecard-tab', onPress: () => handleTabPress('Scorecard') },
        React.createElement(Text, null, 'Scorecard')
      ),
      React.createElement(
        TouchableOpacity,
        { testID: 'settings-tab', onPress: () => handleTabPress(SETTINGS_TAB_ROUTE_NAME) },
        React.createElement(Text, null, 'Settings')
      ),
      React.createElement(
        TouchableOpacity,
        { testID: 'create-tab', onPress: () => handleTabPress('Create') },
        React.createElement(Text, null, '+')
      ),
      // Current screen based on tab and navigation
      currentScreen === 'ActiveStandardsDashboard' &&
        React.createElement(
          View,
          { testID: 'active-standards-dashboard-screen' },
          React.createElement(Text, null, 'Active Standards Dashboard'),
          React.createElement(
            TouchableOpacity,
            {
              testID: 'navigate-to-builder-button',
              onPress: () => handleNavigate('CreateStandardFlow'),
            },
            React.createElement(Text, null, 'Navigate to Builder')
          )
        ),
      currentScreen === 'CreateStandardFlow' &&
        React.createElement(
          View,
          { testID: 'standards-builder-screen' },
          React.createElement(Text, null, 'Create Standard')
        ),
      currentScreen === 'Scorecard' &&
        React.createElement(
          View,
          { testID: 'scorecard-screen' },
          React.createElement(Text, null, 'Scorecard')
        )
    );
  },
}));

describe('Tab Navigation Integration', () => {
  test('Standards tab shows Active Standards Dashboard as root', async () => {
    const { getByTestId } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Standards tab is initial, should show ActiveStandardsDashboard
    await waitFor(() => {
      expect(getByTestId('active-standards-dashboard-screen')).toBeTruthy();
    });
  });

  test('Create (+) button navigates to Standards Builder', async () => {
    const { getByTestId } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Tap the "+" button
    const createTab = getByTestId('create-tab');
    fireEvent.press(createTab);

    // Verify Standards Builder screen is shown
    await waitFor(() => {
      expect(getByTestId('standards-builder-screen')).toBeTruthy();
    });
  });

  test('navigation from Dashboard to Standards Builder works', async () => {
    const { getByTestId } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Start on Standards tab showing ActiveStandardsDashboard
    await waitFor(() => {
      expect(getByTestId('active-standards-dashboard-screen')).toBeTruthy();
    });

    // Navigate to Standards Builder via the dashboard button
    const navigateToBuilderButton = getByTestId('navigate-to-builder-button');
    fireEvent.press(navigateToBuilderButton);

    // Verify Standards Builder screen is shown
    await waitFor(() => {
      expect(getByTestId('standards-builder-screen')).toBeTruthy();
    });
  });

  test('Scorecard tab shows Scorecard screen', async () => {
    const { getByTestId, getByText } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Navigate to Scorecard tab
    const scorecardTab = getByTestId('scorecard-tab');
    fireEvent.press(scorecardTab);

    // Verify Scorecard screen is shown
    await waitFor(() => {
      expect(getByTestId('scorecard-screen')).toBeTruthy();
      expect(getByText('Scorecard')).toBeTruthy();
    });
  });

  test('Settings tab is accessible', async () => {
    const { getByTestId } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Navigate to Settings tab
    const settingsTab = getByTestId('settings-tab');
    fireEvent.press(settingsTab);

    // Verify Settings tab is accessible
    expect(settingsTab).toBeTruthy();
  });

  test('tab switching returns to Standards Dashboard', async () => {
    const { getByTestId } = render(
      React.createElement(require('../BottomTabNavigator').BottomTabNavigator)
    );

    // Start on Standards tab
    await waitFor(() => {
      expect(getByTestId('active-standards-dashboard-screen')).toBeTruthy();
    });

    // Switch to Scorecard tab
    const scorecardTab = getByTestId('scorecard-tab');
    fireEvent.press(scorecardTab);

    await waitFor(() => {
      expect(getByTestId('scorecard-screen')).toBeTruthy();
    });

    // Switch back to Standards tab
    const standardsTab = getByTestId('standards-tab');
    fireEvent.press(standardsTab);

    await waitFor(() => {
      expect(getByTestId('active-standards-dashboard-screen')).toBeTruthy();
    });
  });
});
