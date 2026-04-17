import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Toggle from 'react-native-toggle-element';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CadenceUnit, Weekday } from '@minimum-standards/shared-model';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useStandards, ActiveCapExceededError } from '../../hooks/useStandards';
import { ArchiveToMakeRoomSheet } from '../../components/ArchiveToMakeRoomSheet';
import { useUIPreferencesStore } from '../../stores/uiPreferencesStore';
import { useTheme } from '../../theme/useTheme';
import { trackStandardEvent } from '../../utils/analytics';
import { CADENCE_PRESETS, isPresetCadence, CadencePreset } from '../../utils/cadenceUtils';
import { useSaveEdit } from './useSaveEdit';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

type SelectedPreset = CadencePreset | 'custom';

const WEEKDAY_OPTIONS: Array<{ label: string; value: Weekday; full: string }> = [
  { label: 'Mo', value: 1, full: 'Monday' },
  { label: 'Tu', value: 2, full: 'Tuesday' },
  { label: 'We', value: 3, full: 'Wednesday' },
  { label: 'Th', value: 4, full: 'Thursday' },
  { label: 'Fr', value: 5, full: 'Friday' },
  { label: 'Sa', value: 6, full: 'Saturday' },
  { label: 'Su', value: 7, full: 'Sunday' },
];

const PERIOD_OPTIONS: Array<{ key: SelectedPreset; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

const CUSTOM_UNIT_OPTIONS: Array<{ label: string; value: CadenceUnit }> = [
  { label: 'Days', value: 'day' },
  { label: 'Weeks', value: 'week' },
  { label: 'Months', value: 'month' },
];

function deriveInitialPreset(
  cadence: { interval: number; unit: CadenceUnit } | null,
): SelectedPreset {
  if (!cadence) return 'weekly';
  if (isPresetCadence(cadence, 'daily')) return 'daily';
  if (isPresetCadence(cadence, 'weekly')) return 'weekly';
  if (isPresetCadence(cadence, 'monthly')) return 'monthly';
  return 'custom';
}

export function SetPeriodStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const { createStandard, archiveStandard, activeStandards } = useStandards();
  const parentNavigation = flowNavigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const setPendingScrollToStandardId = useUIPreferencesStore((s) => s.setPendingScrollToStandardId);
  const { editingStandardId, handleSaveEdit, saving: savingEdit, saveError } = useSaveEdit(parentNavigation, mainNavigation);

  const cadence = useStandardsBuilderStore((s) => s.cadence);
  const setCadence = useStandardsBuilderStore((s) => s.setCadence);
  const setPeriodStartPreference = useStandardsBuilderStore((s) => s.setPeriodStartPreference);
  const generatePayload = useStandardsBuilderStore((s) => s.generatePayload);

  // Local UI state
  const [selectedPreset, setSelectedPreset] = useState<SelectedPreset>(() =>
    deriveInitialPreset(cadence),
  );
  const [customInterval, setCustomInterval] = useState<string>(() =>
    cadence && !isPresetCadence(cadence, 'daily') && !isPresetCadence(cadence, 'weekly') && !isPresetCadence(cadence, 'monthly')
      ? String(cadence.interval)
      : '2',
  );
  const [customUnit, setCustomUnit] = useState<CadenceUnit>(() =>
    cadence && !isPresetCadence(cadence, 'daily') && !isPresetCadence(cadence, 'weekly') && !isPresetCadence(cadence, 'monthly')
      ? cadence.unit
      : 'week',
  );

  // Day-of-week state (T027)
  const [showSpecificDays, setShowSpecificDays] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday | null>(null);

  // Submission state (T030)
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capSheetVisible, setCapSheetVisible] = useState(false);

  // Learn more toggle (T029)
  const [learnMoreExpanded, setLearnMoreExpanded] = useState(false);

  // Reset day-of-week state when switching away from weekly (T027 edge case)
  useEffect(() => {
    if (selectedPreset !== 'weekly') {
      setShowSpecificDays(false);
      setSelectedWeekday(null);
      setPeriodStartPreference(null);
    }
  }, [selectedPreset, setPeriodStartPreference]);

  // Sync cadence to store when preset changes
  const handlePresetSelect = useCallback(
    (preset: SelectedPreset) => {
      setSelectedPreset(preset);
      setErrorMessage(null);

      if (preset === 'custom') {
        const interval = parseInt(customInterval, 10);
        if (!isNaN(interval) && interval > 0) {
          setCadence({ interval, unit: customUnit });
        }
      } else {
        setCadence(CADENCE_PRESETS[preset]);
      }
    },
    [setCadence, customInterval, customUnit],
  );

  // Update cadence when custom values change
  const handleCustomIntervalChange = useCallback(
    (text: string) => {
      setCustomInterval(text);
      setErrorMessage(null);
      const interval = parseInt(text, 10);
      if (!isNaN(interval) && interval > 0) {
        setCadence({ interval, unit: customUnit });
      }
    },
    [setCadence, customUnit],
  );

  const handleCustomUnitSelect = useCallback(
    (unit: CadenceUnit) => {
      setCustomUnit(unit);
      setErrorMessage(null);
      const interval = parseInt(customInterval, 10);
      if (!isNaN(interval) && interval > 0) {
        setCadence({ interval, unit });
      }
    },
    [setCadence, customInterval],
  );

  // Day-of-week toggle and selection (T027)
  const handleToggleSpecificDays = useCallback(
    (enabled: boolean) => {
      setShowSpecificDays(enabled);
      if (!enabled) {
        setSelectedWeekday(null);
        setPeriodStartPreference(null);
      }
    },
    [setPeriodStartPreference],
  );

  const handleWeekdaySelect = useCallback(
    (day: Weekday) => {
      if (selectedWeekday === day) {
        // Deselect
        setSelectedWeekday(null);
        setPeriodStartPreference(null);
      } else {
        setSelectedWeekday(day);
        setPeriodStartPreference({ mode: 'weekDay', weekStartDay: day });
      }
    },
    [selectedWeekday, setPeriodStartPreference],
  );

  // Submit handler (T030)
  const handleSubmit = useCallback(async () => {
    setErrorMessage(null);

    const payload = generatePayload();
    if (!payload) {
      setErrorMessage('Please complete all fields before creating your standard.');
      return;
    }

    setSubmitting(true);
    try {
      const newStandard = await createStandard(payload);
      trackStandardEvent('standard_create', { standardName: payload.name });
      // Tell the dashboard to scroll to the newly created standard's card
      setPendingScrollToStandardId(newStandard.id);
      // Dismiss the entire CreateStandardFlow modal via the parent (MainStack) navigator.
      // The flow's unmount cleanup in CreateStandardFlow.tsx handles store reset.
      if (parentNavigation) {
        parentNavigation.goBack();
      } else {
        mainNavigation.goBack();
      }
    } catch (err) {
      if (err instanceof ActiveCapExceededError) {
        setCapSheetVisible(true);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [generatePayload, createStandard, parentNavigation, mainNavigation, setPendingScrollToStandardId]);

  const handleArchiveAndRetry = useCallback(async (standardId: string) => {
    setCapSheetVisible(false);
    const payload = generatePayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      await archiveStandard(standardId);
      const newStandard = await createStandard(payload, { bypassCap: true });
      trackStandardEvent('standard_create', { standardName: payload.name });
      setPendingScrollToStandardId(newStandard.id);
      if (parentNavigation) {
        parentNavigation.goBack();
      } else {
        mainNavigation.goBack();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [archiveStandard, createStandard, generatePayload, parentNavigation, mainNavigation, setPendingScrollToStandardId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <StepHeader
        step={2}
        totalSteps={3}
        title="Set Period"
        onBack={() => flowNavigation.goBack()}
        onClose={() => parentNavigation ? parentNavigation.goBack() : mainNavigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* T029: Inline Tip */}
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
              Focus on total volume per period — flexibility beats rigid daily targets.
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
              The Minimum Standards methodology focuses on total volume over a period rather than
              rigid daily requirements. A weekly target of "run 3 times" is more sustainable than
              "run every Monday, Wednesday, Friday" because life is unpredictable. Choose the longest
              period you're comfortable with — weekly is usually the sweet spot for most people. It
              gives enough flexibility for bad days while maintaining accountability.
            </Text>
          )}
        </View>

        {/* T026: Period Options */}
        <View style={styles.periodSection}>
          <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>
            Choose a Period
          </Text>
          {PERIOD_OPTIONS.map((option) => {
            const isActive = selectedPreset === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.periodOption,
                  {
                    borderColor: isActive
                      ? theme.button.primary.background
                      : theme.border.primary,
                    backgroundColor: isActive
                      ? theme.background.surface
                      : theme.background.chrome,
                  },
                ]}
                onPress={() => handlePresetSelect(option.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    {
                      color: isActive ? theme.text.primary : theme.text.secondary,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <MaterialIcons
                  name={isActive ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={22}
                  color={isActive ? theme.button.primary.background : theme.text.secondary}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* T026: Custom Interval + Unit */}
        {selectedPreset === 'custom' && (
          <View style={styles.customSection}>
            <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>
              Custom Interval
            </Text>
            <View style={styles.customRow}>
              <Text style={[styles.customLabel, { color: theme.text.secondary }]}>Every</Text>
              <TextInput
                style={[
                  styles.customInput,
                  {
                    color: theme.input.text,
                    borderColor: theme.border.primary,
                    borderRadius: BUTTON_BORDER_RADIUS,
                  },
                ]}
                value={customInterval}
                onChangeText={handleCustomIntervalChange}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor={theme.input.placeholder}
                maxLength={3}
              />
              <View style={styles.unitPicker}>
                {CUSTOM_UNIT_OPTIONS.map((unitOption) => {
                  const isActive = customUnit === unitOption.value;
                  return (
                    <TouchableOpacity
                      key={unitOption.value}
                      style={[
                        styles.unitButton,
                        {
                          borderColor: isActive
                            ? theme.button.primary.background
                            : theme.border.primary,
                          backgroundColor: isActive
                            ? theme.background.tertiary
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleCustomUnitSelect(unitOption.value)}
                    >
                      <Text
                        style={[
                          styles.unitButtonText,
                          { color: isActive ? theme.link : theme.text.secondary },
                        ]}
                      >
                        {unitOption.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* T027: Day-of-Week Selectors (Weekly only) */}
        {selectedPreset === 'weekly' && (
          <View style={styles.weekdaySection}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.text.primary }]}>
                Set Custom Start Day
              </Text>
              <Toggle
                value={showSpecificDays}
                onPress={(val) => handleToggleSpecificDays(val ?? !showSpecificDays)}
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
            {showSpecificDays && (
              <View style={styles.weekdayRow}>
                {WEEKDAY_OPTIONS.map((option) => {
                  const isActive = selectedWeekday === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.weekdayButton,
                        {
                          borderColor: isActive ? theme.button.primary.background : theme.border.primary,
                          backgroundColor: 'transparent',
                        },
                      ]}
                      onPress={() => handleWeekdaySelect(option.value)}
                      accessibilityLabel={option.full}
                    >
                      <Text
                        style={[
                          styles.weekdayButtonText,
                          {
                            color: isActive ? theme.text.primary : theme.text.secondary,
                            fontWeight: isActive ? '600' : '400',
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Error message */}
      {(errorMessage || saveError) && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
            {errorMessage || saveError}
          </Text>
        </View>
      )}

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
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: (editingStandardId ? savingEdit : submitting)
                ? theme.button.disabled.background
                : theme.button.primary.background,
            },
          ]}
          onPress={editingStandardId ? handleSaveEdit : handleSubmit}
          disabled={editingStandardId ? savingEdit : submitting}
          activeOpacity={0.7}
        >
          {(editingStandardId ? savingEdit : submitting) ? (
            <ActivityIndicator size="small" color={theme.button.primary.text} />
          ) : (
            <Text style={[styles.submitButtonText, { color: theme.button.primary.text }]}>
              {editingStandardId ? 'Save' : 'Create Standard'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <ArchiveToMakeRoomSheet
        visible={capSheetVisible}
        activeStandards={activeStandards}
        onArchive={handleArchiveAndRetry}
        onRequestClose={() => setCapSheetVisible(false)}
      />
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
    paddingBottom: 24,
  },
  // Tip styles (T029)
  tipContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
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
  // Period section (T026)
  periodSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  periodOptionText: {
    fontSize: 16,
  },
  // Custom section (T026)
  customSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 10,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customLabel: {
    fontSize: 15,
  },
  customInput: {
    width: 56,
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  unitPicker: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Weekday section (T027)
  weekdaySection: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  weekdayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Error
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    padding: 16,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
