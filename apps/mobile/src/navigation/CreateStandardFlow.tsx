import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreateStandardFlowParamList, MainStackParamList } from './types';
import { SelectActivityStep } from '../screens/create-standard/SelectActivityStep';
import { SetVolumeStep } from '../screens/create-standard/SetVolumeStep';
import { SetPeriodStep } from '../screens/create-standard/SetPeriodStep';
import { useTheme } from '../theme/useTheme';
import { useStandardsBuilderStore } from '../stores/standardsBuilderStore';

const Stack = createNativeStackNavigator<CreateStandardFlowParamList>();

// --- StepIndicator ---

function StepIndicator({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={stepIndicatorStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            stepIndicatorStyles.dot,
            i < current
              ? { backgroundColor: theme.button.primary.background }
              : i === current
                ? { backgroundColor: theme.button.primary.background, opacity: 0.6 }
                : { backgroundColor: theme.border.primary },
          ]}
        />
      ))}
    </View>
  );
}

const stepIndicatorStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

// --- StepHeader ---

interface StepHeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  onBack?: () => void;
  onClose: () => void;
}

export function StepHeader({ step, totalSteps, title, onBack, onClose }: StepHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[headerStyles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={[headerStyles.row, { borderBottomColor: theme.border.primary }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={headerStyles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={headerStyles.iconButton} />
        )}
        <Text style={[headerStyles.title, { color: theme.text.primary }]}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={headerStyles.iconButton}>
          <MaterialIcons name="close" size={24} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>
      <StepIndicator current={step} total={totalSteps} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// --- CreateStandardFlow Navigator ---

export function CreateStandardFlow() {
  const reset = useStandardsBuilderStore((s) => s.reset);
  const editingStandardId = useStandardsBuilderStore((s) => s.editingStandardId);
  const route = useRoute<RouteProp<MainStackParamList, 'CreateStandardFlow'>>();
  const initialRoute = route.params?.initialRoute ?? 'SelectActivity';

  // Reset the builder store when the flow mounts (skip if editing an existing standard
  // or entering from suggestor with pre-filled state)
  // and when it unmounts (user navigated away mid-flow — discard state so they start fresh next time)
  React.useEffect(() => {
    if (!editingStandardId && initialRoute === 'SelectActivity') {
      reset();
    }
    return () => {
      reset();
    };
  }, [editingStandardId, initialRoute, reset]);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SelectActivity" component={SelectActivityStep} />
      <Stack.Screen name="SetVolume" component={SetVolumeStep} />
      <Stack.Screen name="SetPeriod" component={SetPeriodStep} />
    </Stack.Navigator>
  );
}
