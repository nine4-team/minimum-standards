import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Standard } from '@minimum-standards/shared-model';
import {
  StandardsStackParamList,
  ScorecardStackParamList,
  SettingsStackParamList,
} from './types';
import { ActivityHistoryScreen } from '../screens/ActivityHistoryScreen';
import { ScorecardSummaryScreen } from '../screens/ScorecardSummaryScreen';
import { StandardsBuilderScreen } from '../screens/StandardsBuilderScreen';
import { StandardsScreen } from '../screens/ActiveStandardsDashboardScreen';
import { StandardDetailScreen } from '../screens/StandardDetailScreen';
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

export function StandardsBuilderScreenWrapper() {
  const navigation = useNavigation<StandardsNavigationProp>();
  const route = useRoute();
  const standardId = (route.params as { standardId?: string })?.standardId;
  return (
    <StandardsBuilderScreen
      onBack={() => navigation.goBack()}
      standardId={standardId}
    />
  );
}

export function StandardsScreenWrapper() {
  const navigation = useNavigation<StandardsNavigationProp>();
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
        navigation.navigate('StandardsBuilder', { standardId });
      }}
      backButtonLabel={undefined}
    />
  );
}

export function StandardsLibraryScreenSettingsWrapper() {
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { standards } = useStandards();

  return (
    <StandardsLibraryScreen
      onBack={() => navigation.goBack()}
      onNavigateToBuilder={() => {
        useStandardsBuilderStore.getState().reset();
        (navigation as any).navigate('CreateStandardFlow');
      }}
      onEditStandard={(standardId) => {
        const standard = standards.find((s) => s.id === standardId);
        if (!standard) return;
        useStandardsBuilderStore.getState().loadFromStandard(standard);
        (navigation as any).navigate('CreateStandardFlow');
      }}
    />
  );
}

export function StandardDetailScreenWrapper({ route }: { route: { params: { standardId: string } } }) {
  const navigation = useNavigation<StandardsNavigationProp>();
  const { standards } = useStandards();
  const standard = standards.find((s) => s.id === route.params.standardId);

  const handleEdit = (standardToEdit: Standard) => {
    if (standardToEdit) {
      navigation.navigate('StandardsBuilder', { standardId: standardToEdit.id });
    }
  };

  const handleArchive = (_standardId: string) => {};

  return (
    <StandardDetailScreen
      standardId={route.params.standardId}
      onBack={() => navigation.goBack()}
      onEdit={handleEdit}
      onArchive={handleArchive}
    />
  );
}
