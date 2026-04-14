import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { SuggestorFlowParamList, MainStackParamList } from '../../navigation/types';
import { SuggestorChip } from '../../components/SuggestorChip';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';

type FlowNav = NativeStackNavigationProp<SuggestorFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SuggestorUnitStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const route = useRoute<RouteProp<SuggestorFlowParamList, 'SuggestorUnit'>>();
  const { activityName, units } = route.params;

  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [isOther, setIsOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  const finalUnit = isOther ? otherText.trim() : selectedUnit ?? '';
  const canProceed = finalUnit.length > 0;

  const handleSelectUnit = (unit: string) => {
    setSelectedUnit(unit);
    setIsOther(false);
  };

  const handleSelectOther = () => {
    setSelectedUnit(null);
    setIsOther(true);
  };

  const handleContinue = () => {
    const store = useStandardsBuilderStore.getState();
    store.reset();
    store.setName(activityName);
    store.setUnit(finalUnit);

    // Replace the SuggestorFlow with CreateStandardFlow starting at SetVolume
    mainNavigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          {
            name: 'CreateStandardFlow',
            params: { initialRoute: 'SetVolume' },
          },
        ],
      })
    );
  };

  const handleBack = () => {
    flowNavigation.goBack();
  };

  const handleClose = () => {
    mainNavigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background.screen }]}>
      <StepHeader
        step={2}
        totalSteps={3}
        title="Pick a Unit"
        onBack={handleBack}
        onClose={handleClose}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.activityLabel, { backgroundColor: theme.background.chrome, borderColor: theme.border.primary }]}>
          <Text style={[styles.activityLabelTitle, { color: theme.text.secondary }]}>
            Activity
          </Text>
          <Text style={[styles.activityLabelName, { color: theme.text.primary }]}>
            {activityName}
          </Text>
        </View>

        <Text style={[styles.label, { color: theme.text.primary }]}>
          How will you measure this?
        </Text>

        <View style={styles.chipRow}>
          {units.map((unit) => (
            <SuggestorChip
              key={unit}
              label={unit}
              isSelected={!isOther && selectedUnit === unit}
              onPress={() => handleSelectUnit(unit)}
            />
          ))}
          <SuggestorChip
            label="Other..."
            isSelected={isOther}
            onPress={handleSelectOther}
          />
        </View>

        {isOther ? (
          <View style={styles.otherInputSection}>
            <TextInput
              style={[
                styles.otherInput,
                {
                  backgroundColor: theme.input.background,
                  borderColor: theme.button.primary.background,
                  color: theme.input.text,
                  borderRadius: BUTTON_BORDER_RADIUS,
                },
              ]}
              value={otherText}
              onChangeText={setOtherText}
              placeholder="Unit of measurement"
              placeholderTextColor={theme.input.placeholder}
              autoFocus
              maxLength={50}
            />
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background.chrome,
            borderTopColor: theme.border.primary,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: canProceed
                ? theme.button.primary.background
                : theme.button.disabled.background,
            },
          ]}
          onPress={handleContinue}
          disabled={!canProceed}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: canProceed
                  ? theme.button.primary.text
                  : theme.button.disabled.text,
              },
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  activityLabel: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  activityLabelTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activityLabelName: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otherInputSection: {
    marginTop: 4,
  },
  otherInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
