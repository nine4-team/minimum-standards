import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { SuggestorFlowParamList, MainStackParamList } from '../../navigation/types';
import { SuggestorChip } from '../../components/SuggestorChip';
import { useTheme } from '../../theme/useTheme';

type FlowNav = NativeStackNavigationProp<SuggestorFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SuggestorActivityStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const route = useRoute<RouteProp<SuggestorFlowParamList, 'SuggestorActivity'>>();
  const { suggestions } = route.params;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isOther, setIsOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  const selectedName = isOther
    ? otherText.trim()
    : selectedIndex !== null
      ? suggestions[selectedIndex].name
      : '';

  const selectedUnits = !isOther && selectedIndex !== null
    ? suggestions[selectedIndex].units
    : [];

  const canProceed = selectedName.length > 0;

  const handleSelectSuggestion = (index: number) => {
    setSelectedIndex(index);
    setIsOther(false);
  };

  const handleSelectOther = () => {
    setSelectedIndex(null);
    setIsOther(true);
  };

  const handleNext = () => {
    flowNavigation.navigate('SuggestorUnit', {
      activityName: selectedName,
      units: selectedUnits,
    });
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
        step={1}
        totalSteps={3}
        title="Pick an Activity"
        onBack={handleBack}
        onClose={handleClose}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: theme.text.primary }]}>
          Choose an activity or type your own
        </Text>

        <View style={styles.chipRow}>
          {suggestions.map((suggestion, index) => (
            <SuggestorChip
              key={suggestion.name}
              label={suggestion.name}
              isSelected={!isOther && selectedIndex === index}
              onPress={() => handleSelectSuggestion(index)}
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
              placeholder="Activity name"
              placeholderTextColor={theme.input.placeholder}
              autoFocus
              maxLength={120}
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
          onPress={handleNext}
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
            Next
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
