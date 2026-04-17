import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Toggle from 'react-native-toggle-element';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';
import { useSaveEdit } from './useSaveEdit';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SetVolumeStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const parentNavigation = flowNavigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const { editingStandardId, handleSaveEdit, saving, saveError } = useSaveEdit(parentNavigation, mainNavigation);

  const goalTotal = useStandardsBuilderStore((s) => s.goalTotal);
  const setGoalTotal = useStandardsBuilderStore((s) => s.setGoalTotal);
  const getEffectiveUnit = useStandardsBuilderStore((s) => s.getEffectiveUnit);
  const breakdownEnabled = useStandardsBuilderStore((s) => s.breakdownEnabled);
  const setBreakdownEnabled = useStandardsBuilderStore((s) => s.setBreakdownEnabled);
  const sessionsPerCadence = useStandardsBuilderStore((s) => s.sessionsPerCadence);
  const setSessionsPerCadence = useStandardsBuilderStore((s) => s.setSessionsPerCadence);
  const volumePerSession = useStandardsBuilderStore((s) => s.volumePerSession);
  const setVolumePerSession = useStandardsBuilderStore((s) => s.setVolumePerSession);

  // Local string state for TextInput display
  const [goalTotalText, setGoalTotalText] = useState(
    goalTotal !== null ? String(goalTotal) : '',
  );
  const [sessionsText, setSessionsText] = useState(
    sessionsPerCadence !== null ? String(sessionsPerCadence) : '',
  );
  const [volumePerSessionText, setVolumePerSessionText] = useState(
    volumePerSession !== null ? String(volumePerSession) : '',
  );

  const [learnMoreExpanded, setLearnMoreExpanded] = useState(false);

  const effectiveUnit = getEffectiveUnit();

  const handleClose = useCallback(() => {
    parentNavigation ? parentNavigation.goBack() : mainNavigation.goBack();
  }, [parentNavigation, mainNavigation]);

  const handleBack = useCallback(() => {
    if (flowNavigation.canGoBack()) {
      flowNavigation.goBack();
    } else {
      // No SelectActivity to go back to (entered via suggestor) — close the flow
      handleClose();
    }
  }, [flowNavigation, handleClose]);

  const handleGoalTotalChange = useCallback(
    (text: string) => {
      setGoalTotalText(text);
      const parsed = parseFloat(text);
      if (text === '' || isNaN(parsed)) {
        setGoalTotal(null);
      } else {
        setGoalTotal(parsed);
      }
    },
    [setGoalTotal],
  );

  const handleSessionsChange = useCallback(
    (text: string) => {
      setSessionsText(text);
      const parsed = parseFloat(text);
      if (text === '' || isNaN(parsed)) {
        setSessionsPerCadence(null);
      } else {
        setSessionsPerCadence(parsed);
      }
    },
    [setSessionsPerCadence],
  );

  const handleVolumePerSessionChange = useCallback(
    (text: string) => {
      setVolumePerSessionText(text);
      const parsed = parseFloat(text);
      if (text === '' || isNaN(parsed)) {
        setVolumePerSession(null);
      } else {
        setVolumePerSession(parsed);
      }
    },
    [setVolumePerSession],
  );

  const handleBreakdownToggle = useCallback(
    (enabled: boolean) => {
      setBreakdownEnabled(enabled);
      if (enabled) {
        // Clear the direct goalTotal text since it's now auto-calculated
        setGoalTotalText('');
      } else {
        // Restore goalTotal text from store value
        const currentGoalTotal = useStandardsBuilderStore.getState().goalTotal;
        setGoalTotalText(currentGoalTotal !== null ? String(currentGoalTotal) : '');
      }
    },
    [setBreakdownEnabled],
  );

  const canProceed = breakdownEnabled
    ? sessionsPerCadence !== null &&
      sessionsPerCadence > 0 &&
      volumePerSession !== null &&
      volumePerSession > 0
    : goalTotal !== null && goalTotal > 0;

  const handleNext = useCallback(() => {
    if (canProceed) {
      flowNavigation.navigate('SetPeriod');
    }
  }, [canProceed, flowNavigation]);

  // Display value for goalTotal when breakdown is enabled (auto-calculated)
  const displayGoalTotal = breakdownEnabled
    ? goalTotal !== null
      ? String(goalTotal)
      : ''
    : goalTotalText;

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <StepHeader
        step={1}
        totalSteps={3}
        title="Set Volume"
        onBack={handleBack}
        onClose={handleClose}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* T025: Inline Tip */}
          <View
            style={[
              styles.tipContainer,
              {
                backgroundColor: theme.background.surface,
                borderLeftColor: theme.button.primary.background,
              },
            ]}
          >
            <View style={styles.tipRow}>
              <MaterialIcons
                name="lightbulb-outline"
                size={16}
                color={theme.text.secondary}
                style={styles.tipIcon}
              />
              <Text style={[styles.tipText, { color: theme.text.secondary }]}>
                Start where you can consistently win, not at your ideal level.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setLearnMoreExpanded(!learnMoreExpanded)}
              style={styles.learnMoreButton}
            >
              <Text style={[styles.learnMoreText, { color: theme.button.primary.background }]}>
                {learnMoreExpanded ? 'Show Less' : 'Learn More'}
              </Text>
              <MaterialIcons
                name={learnMoreExpanded ? 'expand-less' : 'expand-more'}
                size={16}
                color={theme.button.primary.background}
              />
            </TouchableOpacity>
            {learnMoreExpanded && (
              <Text style={[styles.learnMoreContent, { color: theme.text.secondary }]}>
                Your Minimum Standard should be low enough that you can hit it even on your worst
                day. The goal isn't to set your ideal volume — it's to set the floor that you never
                go below. Once you build consistency at this level, you can always increase it later.
                Think of it as your "never go below this" commitment, not your aspiration.
              </Text>
            )}
          </View>

          {/* Unit label (read-only, inherited from activity) */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Unit</Text>
            <View
              style={[
                styles.readOnlyField,
                {
                  backgroundColor: theme.background.surface,
                  borderColor: theme.border.primary,
                },
              ]}
            >
              <Text style={[styles.readOnlyText, { color: theme.text.primary }]}>
                {effectiveUnit || '—'}
              </Text>
            </View>
          </View>

          {/* T023: Volume target input */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
              Volume Target
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.input.text,
                  backgroundColor: breakdownEnabled
                    ? theme.background.surface
                    : theme.background.chrome,
                  borderColor: theme.border.primary,
                },
              ]}
              value={displayGoalTotal}
              onChangeText={handleGoalTotalChange}
              placeholder="e.g. 30"
              placeholderTextColor={theme.input.placeholder}
              keyboardType="numeric"
              editable={!breakdownEnabled}
            />
            {breakdownEnabled && (
              <Text style={[styles.fieldHint, { color: theme.text.secondary }]}>
                Auto-calculated from sessions below
              </Text>
            )}
          </View>

          {/* T024: Session Breakdown Toggle */}
          <View
            style={[
              styles.switchRow,
              {
                backgroundColor: theme.background.surface,
                borderColor: theme.border.primary,
              },
            ]}
          >
            <Text style={[styles.switchLabel, { color: theme.text.primary }]}>
              Break Volume into Sessions
            </Text>
            <Toggle
              value={breakdownEnabled}
              onPress={(val) => handleBreakdownToggle(val ?? !breakdownEnabled)}
              trackBar={{
                width: 50,
                height: 30,
                radius: 15,
                activeBackgroundColor: theme.button.primary.background,
                inActiveBackgroundColor: theme.border.primary,
              }}
              thumbButton={{
                width: 26,
                height: 26,
                radius: 13,
                activeBackgroundColor: '#FFFFFF',
                inActiveBackgroundColor: '#FFFFFF',
              }}
            />
          </View>

          {/* T024: Session breakdown fields */}
          {breakdownEnabled && (
            <View style={styles.breakdownFields}>
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                  Sessions per period
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: theme.input.text,
                      backgroundColor: theme.background.chrome,
                      borderColor: theme.border.primary,
                    },
                  ]}
                  value={sessionsText}
                  onChangeText={handleSessionsChange}
                  placeholder="e.g. 3"
                  placeholderTextColor={theme.input.placeholder}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
                  Volume per session
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: theme.input.text,
                      backgroundColor: theme.background.chrome,
                      borderColor: theme.border.primary,
                    },
                  ]}
                  value={volumePerSessionText}
                  onChangeText={handleVolumePerSessionChange}
                  placeholder="e.g. 10"
                  placeholderTextColor={theme.input.placeholder}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
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
          {editingStandardId ? (
            <>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  {
                    backgroundColor: canProceed && !saving
                      ? theme.button.primary.background
                      : theme.button.disabled.background,
                  },
                ]}
                onPress={handleSaveEdit}
                disabled={!canProceed || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.button.primary.text} />
                ) : (
                  <Text style={[styles.nextButtonText, { color: canProceed ? theme.button.primary.text : theme.button.disabled.text }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
              {saveError && (
                <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
                  {saveError}
                </Text>
              )}
              <TouchableOpacity
                style={styles.nextLink}
                onPress={handleNext}
                disabled={!canProceed}
              >
                <Text style={[styles.nextLinkText, { color: canProceed ? theme.link : theme.text.secondary }]}>
                  Next →
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.nextButton,
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
                  styles.nextButtonText,
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
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Tip styles (T025)
  tipContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 24,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  learnMoreContent: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    paddingLeft: 24,
  },
  // Field styles
  fieldContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 4,
  },
  readOnlyField: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  readOnlyText: {
    fontSize: 16,
  },
  textInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  // Switch row styles (T024)
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  // Breakdown fields
  breakdownFields: {
    marginTop: 4,
  },
  // Footer styles
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  nextButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  nextLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
