import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SETTINGS_TAB_ROUTE_NAME,
  StandardsStackParamList,
  ScorecardStackParamList,
  SettingsStackParamList,
} from './types';
import { ActivityHistoryScreen } from '../screens/ActivityHistoryScreen';
import { ScorecardSummaryScreen } from '../screens/ScorecardSummaryScreen';
import { StandardsScreen } from '../screens/ActiveStandardsDashboardScreen';
import { StandardsLibraryScreen } from '../screens/StandardsLibraryScreen';
import { useStandards } from '../hooks/useStandards';
import { useStandardsBuilderStore } from '../stores/standardsBuilderStore';

type StandardsNavigationProp = NativeStackNavigationProp<StandardsStackParamList>;
type ScorecardNavigationProp = NativeStackNavigationProp<ScorecardStackParamList>;

// Wrapper components that adapt existing screens to React Navigation
export function ScorecardSummaryScreenWrapper() {
  const navigation = useNavigation<ScorecardNavigationProp>();

  return (
    <ScorecardSummaryScreen
      onNavigateToDetail={(standardId) => {
        navigation.navigate('ScorecardDetail', { standardId });
      }}
    />
  );
}

export function ScorecardDetailScreenWrapper() {
  const navigation = useNavigation<ScorecardNavigationProp>();
  const route = useRoute();
  const standardId = (route.params as { standardId: string }).standardId;

  return (
    <ActivityHistoryScreen
      standardId={standardId}
      onBack={() => navigation.goBack()}
    />
  );
}

export function StandardsScreenWrapper() {
  const navigation = useNavigation<StandardsNavigationProp>();
  const rootNavigation = useNavigation<any>();
  const { standards } = useStandards();
  return (
    <StandardsScreen
      onBack={() => {}}
      onLaunchBuilder={() => {
        (navigation as any).navigate('CreateStandardFlow');
      }}
      onNavigateToDetail={(standardId: string) => {
        // No navigation per Activity History plan - standard taps are now a no-op
      }}
      onEditStandard={(standardId) => {
        const standard = standards.find((s) => s.id === standardId);
        if (!standard) return;
        useStandardsBuilderStore.getState().loadFromStandard(standard);
        (navigation as any).navigate('EditStandard');
      }}
      onOrganizeStandards={() => {
        rootNavigation.navigate(SETTINGS_TAB_ROUTE_NAME, {
          screen: 'StandardsLibrary',
          params: { returnTo: 'StandardsDashboard' },
        });
      }}
      backButtonLabel={undefined}
    />
  );
}

export function StandardsLibraryScreenSettingsWrapper() {
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const rootNavigation = useNavigation<any>();
  const route = useRoute();
  const { standards } = useStandards();
  const returnTo = (route.params as SettingsStackParamList['StandardsLibrary'])?.returnTo;

  return (
    <StandardsLibraryScreen
      onBack={() => {
        if (returnTo === 'StandardsDashboard') {
          rootNavigation.navigate('Standards', {
            screen: 'ActiveStandardsDashboard',
          });
          return;
        }
        navigation.goBack();
      }}
      onNavigateToBuilder={() => {
        useStandardsBuilderStore.getState().reset();
        (navigation as any).navigate('CreateStandardFlow');
      }}
      onEditStandard={(standardId) => {
        const standard = standards.find((s) => s.id === standardId);
        if (!standard) return;
        useStandardsBuilderStore.getState().loadFromStandard(standard);
        (navigation as any).navigate('EditStandard');
      }}
    />
  );
}
