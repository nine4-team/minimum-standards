import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  CadenceUnit,
  StandardCadence,
  Weekday,
} from '@minimum-standards/shared-model';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StandardsLibraryModal } from '../components/StandardsLibraryModal';
import { useStandardsBuilderStore } from '../stores/standardsBuilderStore';
import {
  CADENCE_PRESETS,
  CadencePreset,
  getCadencePreset,
  validateCadence,
  isPresetCadence,
} from '../utils/cadenceUtils';
import { useStandards, ActiveCapExceededError } from '../hooks/useStandards';
import { ArchiveToMakeRoomSheet } from '../components/ArchiveToMakeRoomSheet';
import { trackStandardEvent } from '../utils/analytics';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { Standard } from '@minimum-standards/shared-model';
import { useTheme } from '../theme/useTheme';
import { typography, BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const WEEKDAY_OPTIONS: Array<{ label: string; value: Weekday; full: string }> = [
  { label: 'Mo', value: 1, full: 'Monday' },
  { label: 'Tu', value: 2, full: 'Tuesday' },
  { label: 'We', value: 3, full: 'Wednesday' },
  { label: 'Th', value: 4, full: 'Thursday' },
  { label: 'Fr', value: 5, full: 'Friday' },
  { label: 'Sa', value: 6, full: 'Saturday' },
  { label: 'Su', value: 7, full: 'Sunday' },
];

export interface StandardsBuilderScreenProps {
  onBack: () => void;
  standardId?: string;
}

const CADENCE_UNIT_OPTIONS: CadenceUnit[] = ['day', 'week', 'month'];

export function StandardsBuilderScreen({ onBack, standardId }: StandardsBuilderScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    name: standardName,
    setName: setStandardName,
    unit: standardUnit,
    setUnit: setStandardUnit,
    notes: standardNotes,
    setNotes: setStandardNotes,
    cadence,
    setCadence,
    goalTotal,
    setGoalTotal,
    unitOverride,
    setUnitOverride,
    breakdownEnabled,
    setBreakdownEnabled,
    sessionLabel,
    setSessionLabel,
    sessionsPerCadence,
    setSessionsPerCadence,
    volumePerSession,
    setVolumePerSession,
    periodStartPreference,
    setPeriodStartPreference,
    getSummaryPreview,
    generatePayload,
    reset,
  } = useStandardsBuilderStore();

  const {
    createStandard,
    updateStandard,
    standards,
    unarchiveStandard,
    archiveStandard,
    activeStandards,
  } = useStandards();
  const [capSheetVisible, setCapSheetVisible] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null);
  const [standardsLibraryVisible, setStandardsLibraryVisible] = useState(false);
  const [activePreset, setActivePreset] = useState<CadencePreset | null>('weekly');
  const [customIntervalInput, setCustomIntervalInput] = useState('1');
  const [customUnit, setCustomUnit] = useState<CadenceUnit>('week');
  const [cadenceError, setCadenceError] = useState<string | null>(null);
  const [goalTotalError, setGoalTotalError] = useState<string | null>(null);
  const [sessionConfigError, setSessionConfigError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hiddenFromGroup, setHiddenFromGroup] = useState(false);

  const summaryPreview = getSummaryPreview();
  const isEditMode = !!standardId;
  const standardToEdit = standardId ? standards.find((s) => s.id === standardId) : null;
  const hasPrefilledRef = useRef<string | null>(null);
  const selectedWeekday = periodStartPreference?.mode === 'weekDay' ? periodStartPreference.weekStartDay : 1; // Default to Monday
  
  // Check if cadence is not daily to show weekday picker
  const showWeekdayPicker = cadence && cadence.unit !== 'day';

  // Pre-fill form when editing
  useEffect(() => {
    if (!isEditMode) {
      hasPrefilledRef.current = null;
      return;
    }

    if (!standardId || !standardToEdit) {
      return;
    }

    if (hasPrefilledRef.current === standardId) {
      return;
    }

    setStandardName(standardToEdit.name);
    setStandardUnit(standardToEdit.unit);
    setStandardNotes(standardToEdit.notes ?? null);
    setCadence(standardToEdit.cadence);
    setUnitOverride(null);
    
    // Set cadence preset if it matches
    let matchedPreset: CadencePreset | null = null;
    if (isPresetCadence(standardToEdit.cadence, 'daily')) {
      matchedPreset = 'daily';
    } else if (isPresetCadence(standardToEdit.cadence, 'weekly')) {
      matchedPreset = 'weekly';
    } else if (isPresetCadence(standardToEdit.cadence, 'monthly')) {
      matchedPreset = 'monthly';
    }
    
    if (matchedPreset) {
      setActivePreset(matchedPreset);
      setCustomIntervalInput(String(standardToEdit.cadence.interval));
      setCustomUnit(standardToEdit.cadence.unit);
    } else {
      setActivePreset(null);
      setCustomIntervalInput(String(standardToEdit.cadence.interval));
      setCustomUnit(standardToEdit.cadence.unit);
    }
    
    // Populate session config
    const sessionConfig = standardToEdit.sessionConfig;
    setSessionLabel(sessionConfig.sessionLabel);
    
    if (sessionConfig.sessionsPerCadence > 1) {
      // Session-based mode
      setBreakdownEnabled(true);
      setSessionsPerCadence(sessionConfig.sessionsPerCadence);
      setVolumePerSession(sessionConfig.volumePerSession);
      setGoalTotal(standardToEdit.minimum); // Show total for reference
    } else {
      // Direct minimum mode
      setBreakdownEnabled(false);
      setGoalTotal(standardToEdit.minimum);
    }

    setPeriodStartPreference(standardToEdit.periodStartPreference ?? null);
    setHiddenFromGroup(standardToEdit.hiddenFromGroup === true);
    hasPrefilledRef.current = standardId;
  }, [
    isEditMode,
    setBreakdownEnabled,
    setCadence,
    setGoalTotal,
    setStandardName,
    setStandardUnit,
    setStandardNotes,
    setSessionLabel,
    setSessionsPerCadence,
    setUnitOverride,
    setVolumePerSession,
    setPeriodStartPreference,
    standardId,
    standardToEdit,
  ]);

  useEffect(() => {
    if (goalTotal !== null && goalTotal > 0 && goalTotalError) {
      setGoalTotalError(null);
    }
  }, [goalTotal, goalTotalError]);

  // Set Monday as default when weekday picker appears and no preference is set
  useEffect(() => {
    if (showWeekdayPicker && !periodStartPreference) {
      setPeriodStartPreference({ mode: 'weekDay', weekStartDay: 1 });
    }
  }, [showWeekdayPicker, periodStartPreference, setPeriodStartPreference]);

  const handleWeekdaySelect = useCallback(
    (day: Weekday) => {
      setPeriodStartPreference({ mode: 'weekDay', weekStartDay: day });
    },
    [setPeriodStartPreference]
  );

  const handleStandardSelect = (standard: Standard) => {
    setStandardName(standard.name);
    setStandardUnit(standard.unit);
    setStandardNotes(standard.notes ?? null);
    setCadence(standard.cadence);
    setUnitOverride(null);
    
    // Populate session config
    const sessionConfig = standard.sessionConfig;
    setSessionLabel(sessionConfig.sessionLabel);
    
    if (sessionConfig.sessionsPerCadence > 1) {
      // Session-based mode
      setBreakdownEnabled(true);
      setSessionsPerCadence(sessionConfig.sessionsPerCadence);
      setVolumePerSession(sessionConfig.volumePerSession);
      setGoalTotal(standard.minimum); // Show total for reference
    } else {
      // Direct minimum mode
      setBreakdownEnabled(false);
      setGoalTotal(standard.minimum);
    }
    
    setStandardsLibraryVisible(false);
    setPeriodStartPreference(standard.periodStartPreference ?? null);
  };

  const handlePresetPress = useCallback(
    (preset: CadencePreset) => {
      const presetCadence = getCadencePreset(preset);
      setActivePreset(preset);
      setCadence(presetCadence);
      setCadenceError(null);
      setCustomIntervalInput(String(presetCadence.interval));
      setCustomUnit(presetCadence.unit);
    },
    [setActivePreset, setCadence, setCadenceError, setCustomIntervalInput, setCustomUnit]
  );

  const handleCustomIntervalChange = (value: string) => {
    setCustomIntervalInput(value);
    setActivePreset(null);

    const numeric = Number(value);
    if (!value) {
      setCadenceError('Interval required for custom period');
      setCadence(null);
      return;
    }

    const validation = validateCadence(
      Number.isNaN(numeric) ? null : numeric,
      customUnit
    );

    if (!validation.isValid) {
      setCadenceError(validation.error ?? 'Invalid cadence');
      setCadence(null);
      return;
    }

    setCadenceError(null);
    setCadence({ interval: numeric as number, unit: customUnit } as StandardCadence);
  };

  const handleCustomUnitChange = (unit: CadenceUnit) => {
    setCustomUnit(unit);
    setActivePreset(null);
    handleCustomIntervalChange(customIntervalInput);
  };

  const handleGoalTotalChange = (text: string) => {
    if (!text) {
      setGoalTotal(null);
      setGoalTotalError('Goal total is required');
      return;
    }

    const numeric = Number(text);
    if (Number.isNaN(numeric) || numeric <= 0) {
      setGoalTotalError('Enter a positive number');
      setGoalTotal(null);
      return;
    }

    setGoalTotalError(null);
    setGoalTotal(numeric);
  };

  const handleSessionsPerCadenceChange = (text: string) => {
    if (!text) {
      setSessionsPerCadence(null);
      return;
    }

    const numeric = Number(text);
    if (Number.isNaN(numeric) || numeric <= 0 || !Number.isInteger(numeric)) {
      setSessionConfigError('Enter a positive whole number');
      setSessionsPerCadence(null);
      return;
    }

    setSessionConfigError(null);
    setSessionsPerCadence(numeric);
  };

  const handleVolumePerSessionChange = (text: string) => {
    if (!text) {
      setVolumePerSession(null);
      return;
    }

    const numeric = Number(text);
    if (Number.isNaN(numeric) || numeric <= 0) {
      setSessionConfigError('Enter a positive number');
      setVolumePerSession(null);
      return;
    }

    setSessionConfigError(null);
    setVolumePerSession(numeric);
  };

  const handleSessionLabelChange = (text: string) => {
    setSessionLabel(text.trim() || 'session');
  };

  const handleUnitOverrideChange = (text: string) => {
    setUnitOverride(text.trim() ? text.trim().toLowerCase() : null);
  };

  const resetForm = () => {
    reset();
    setActivePreset('weekly');
    setCustomIntervalInput('1');
    setCustomUnit('week');
    setCadenceError(null);
    setGoalTotalError(null);
    setSessionConfigError(null);
    setSaveError(null);
  };

  const handleSave = async ({ bypassCap = false }: { bypassCap?: boolean } = {}) => {
    setSaveError(null);
    if (!standardName.trim()) {
      setSaveError('Enter a name for your standard');
      return;
    }
    if (!goalTotal || goalTotal <= 0) {
      setGoalTotalError('Goal total is required');
      return;
    }
    if (!cadence) {
      setCadenceError('Pick a period');
      return;
    }
    if (breakdownEnabled) {
      if (!sessionsPerCadence || sessionsPerCadence <= 0) {
        setSessionConfigError('Sessions per period is required');
        return;
      }
      if (!volumePerSession || volumePerSession <= 0) {
        setSessionConfigError('Volume per session is required');
        return;
      }
    }

    const payload = generatePayload();
    if (!payload) {
      setSaveError('Complete all required fields to continue');
      return;
    }

    const {
      periodStartPreference: preference,
      ...standardPayload
    } = payload;

    setSaving(true);
    let shouldCloseAfterSave = false;
    let createdStandardId: string | null = null;
    try {
      if (isEditMode && standardId) {
        // Update existing standard
        const shouldClearPeriodPreference =
          !!standardToEdit?.periodStartPreference && !preference;

        await updateStandard({
          standardId,
          ...standardPayload,
          periodStartPreference: preference,
          clearPeriodStartPreference: shouldClearPeriodPreference,
          hiddenFromGroup,
        });
        trackStandardEvent('standard_edit', {
          standardId,
          standardName: payload.name,
          cadence: payload.cadence,
        });
        Alert.alert('Standard updated', 'Your Standard has been updated successfully.');
        shouldCloseAfterSave = true;
      } else {
        // Check for duplicate Standard when creating (match by name + cadence + minimum + unit)
        const matchingStandard = standards.find(
          (s) =>
            s.name.toLowerCase() === payload.name.toLowerCase() &&
            s.cadence.interval === payload.cadence.interval &&
            s.cadence.unit === payload.cadence.unit &&
            s.minimum === payload.minimum &&
            s.unit === payload.unit
        );

        if (matchingStandard) {
          // If duplicate found and archived: unarchive it
          if (
            matchingStandard.state === 'archived' ||
            matchingStandard.archivedAtMs !== null
          ) {
            await unarchiveStandard(matchingStandard.id, { bypassCap });
            Alert.alert(
              'Standard activated',
              'An existing inactive Standard has been activated.'
            );
            createdStandardId = matchingStandard.id;
            shouldCloseAfterSave = true;
          } else {
            // If duplicate found and active: show error
            setSaveError('A Standard with these values already exists');
            return;
          }
        } else {
          // No duplicate found: create new Standard
          const newStandard = await createStandard(
            {
              ...standardPayload,
              periodStartPreference: preference,
            },
            { bypassCap }
          );
          trackStandardEvent('standard_create', {
            standardName: payload.name,
            archived: false,
            cadence: payload.cadence,
          });
          Alert.alert('Standard saved', 'Your Standard has been saved successfully.');
          createdStandardId = newStandard.id;
          shouldCloseAfterSave = true;
        }
        resetForm();
      }
    } catch (err) {
      if (err instanceof ActiveCapExceededError) {
        setPendingRetry(() => () => handleSave({ bypassCap: true }));
        setCapSheetVisible(true);
        return;
      }
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save Standard'
      );
    } finally {
      setSaving(false);
      if (shouldCloseAfterSave) {
        if (createdStandardId) {
          useUIPreferencesStore.getState().setPendingScrollToStandardId(createdStandardId);
        }
        onBack();
      }
    }
  };

  const handleCustomPress = useCallback(() => {
    setActivePreset(null);
    setCadenceError(null);
  }, []);

  const cadencePresetButtons = useMemo(
    () => {
      const presetButtons = (Object.keys(CADENCE_PRESETS) as CadencePreset[]).map((preset) => {
        const isActive = activePreset === preset;
        return (
          <TouchableOpacity
            key={preset}
            style={[
              styles.pillButton,
              {
                backgroundColor: isActive ? theme.button.primary.background : theme.button.secondary.background,
              },
            ]}
            onPress={() => handlePresetPress(preset)}
          >
            <Text
              style={[
                styles.pillButtonText,
                {
                  fontSize: typography.button.pill.fontSize,
                  fontWeight: typography.button.pill.fontWeight,
                  color: isActive ? theme.button.primary.text : theme.text.secondary,
                },
              ]}
            >
              {preset.charAt(0).toUpperCase() + preset.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      });

      const isCustomActive = activePreset === null;
      const customButton = (
        <TouchableOpacity
          key="custom"
          style={[
            styles.pillButton,
            {
              backgroundColor: isCustomActive ? theme.button.primary.background : theme.button.secondary.background,
            },
          ]}
          onPress={handleCustomPress}
        >
          <Text
            style={[
              styles.pillButtonText,
              {
                fontSize: typography.button.pill.fontSize,
                fontWeight: typography.button.pill.fontWeight,
                color: isCustomActive ? theme.button.primary.text : theme.text.secondary,
              },
            ]}
          >
            Custom
          </Text>
        </TouchableOpacity>
      );

      return [...presetButtons, customButton];
    },
    [activePreset, handlePresetPress, handleCustomPress, theme]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fullScreen, { backgroundColor: theme.background.screen }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border.primary, backgroundColor: theme.background.chrome, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backButton, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.link }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          {isEditMode ? 'Edit Standard' : 'Create Standard'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <ScrollView style={styles.form} contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
          <View style={styles.stepHeader}>
            <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>Step 1</Text>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Name your standard</Text>
          </View>

          <View style={styles.nameUnitRow}>
            <View style={styles.nameField}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.background,
                    borderColor: theme.input.border,
                    color: theme.input.text,
                  },
                ]}
                placeholderTextColor={theme.input.placeholder}
                placeholder="e.g. Running"
                value={standardName}
                onChangeText={setStandardName}
                maxLength={120}
                accessibilityLabel="Standard name"
              />
            </View>
            <View style={styles.unitField}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Default Unit</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.background,
                    borderColor: theme.input.border,
                    color: theme.input.text,
                  },
                ]}
                placeholderTextColor={theme.input.placeholder}
                placeholder="e.g. minutes"
                value={standardUnit}
                onChangeText={setStandardUnit}
                autoCorrect={false}
                accessibilityLabel="Standard unit"
              />
            </View>
          </View>

          <View style={[styles.notesSection, { borderTopColor: theme.border.secondary }]}>
            <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Notes (Optional)</Text>
            <TextInput
              style={[
                styles.activityNotesInput,
                {
                  backgroundColor: theme.input.background,
                  borderColor: theme.input.border,
                  color: theme.input.text,
                },
              ]}
              value={standardNotes ?? ''}
              onChangeText={(text) => setStandardNotes(text || null)}
              placeholder="Add notes about this standard..."
              placeholderTextColor={theme.input.placeholder}
              multiline
              numberOfLines={3}
              maxLength={1000}
              accessibilityLabel="Standard notes"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
          <View style={styles.stepHeader}>
            <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>Step 2</Text>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Period</Text>
          </View>
          <View style={styles.pillRow}>{cadencePresetButtons}</View>

          {activePreset === null && (
            <View style={styles.customCadenceRow}>
              <View style={styles.customIntervalField}>
                <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Interval</Text>
                <TextInput
                  value={customIntervalInput}
                  onChangeText={handleCustomIntervalChange}
                  keyboardType="number-pad"
                  placeholder="e.g. 2"
                  placeholderTextColor={theme.input.placeholder}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.input.background,
                      borderColor: theme.input.border,
                      color: theme.input.text,
                    },
                  ]}
                />
              </View>
              <View style={styles.customField}>
                <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Unit</Text>
                <View style={styles.unitRow}>
                  {CADENCE_UNIT_OPTIONS.map((unit) => {
                    const isActive = customUnit === unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          {
                            borderColor: theme.border.primary,
                            backgroundColor: isActive ? theme.background.tertiary : 'transparent',
                          },
                        isActive && { borderColor: theme.link },
                        ]}
                        onPress={() => handleCustomUnitChange(unit)}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            {
                              fontSize: typography.button.secondary.fontSize,
                              fontWeight: typography.button.secondary.fontWeight,
                              color: isActive ? theme.link : theme.text.secondary,
                            },
                          ]}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
          {cadenceError && <Text style={[styles.errorText, { color: theme.input.borderError }]}>{cadenceError}</Text>}
          
          {showWeekdayPicker && (
            <View style={styles.alignmentSection}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Start on a specific weekday</Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_OPTIONS.map((option) => {
                  const isActive = selectedWeekday === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.weekdayButton,
                        {
                          borderColor: isActive ? theme.link : theme.border.primary,
                          backgroundColor: isActive ? theme.background.tertiary : 'transparent',
                        },
                      ]}
                      onPress={() => handleWeekdaySelect(option.value)}
                    >
                      <Text
                        style={[
                          styles.weekdayButtonText,
                          {
                            color: isActive ? theme.link : theme.text.secondary,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
          <View style={styles.stepHeader}>
            <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>Step 3</Text>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Volume</Text>
          </View>

          {!breakdownEnabled && (
            <>
              <Text style={[styles.helperText, { color: theme.text.secondary }]}>
                Set your total target for the period.
              </Text>
              <View style={styles.minimumUnitRow}>
                <View style={styles.minimumUnitField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                    Total per {cadence ? (cadence.interval === 1 ? cadence.unit : `${cadence.interval} ${cadence.unit}s`) : 'period'}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    keyboardType="number-pad"
                    placeholder="e.g. 75"
                    value={goalTotal ? String(goalTotal) : ''}
                    onChangeText={handleGoalTotalChange}
                  />
                  {goalTotalError && <Text style={[styles.errorText, { color: theme.input.borderError }]}>{goalTotalError}</Text>}
                </View>
                <View style={styles.minimumUnitField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Unit</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    placeholder={
                      standardUnit
                        ? `Default: ${standardUnit}`
                        : 'Unit'
                    }
                    value={unitOverride ?? ''}
                    onChangeText={handleUnitOverrideChange}
                    autoCorrect={false}
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.breakdownSection}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setBreakdownEnabled(!breakdownEnabled)}
            >
              <Text style={[styles.toggleLabel, { color: theme.text.primary }]}>
                Break this volume into sessions
              </Text>
              <View
                style={[
                  styles.toggle,
                  {
                    backgroundColor: breakdownEnabled ? theme.button.primary.background : theme.input.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      backgroundColor: theme.background.primary,
                      transform: [{ translateX: breakdownEnabled ? 20 : 0 }],
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {breakdownEnabled && (
            <View style={styles.sessionConfigSection}>
              <View style={styles.sessionConfigRow}>
                <View style={styles.sessionConfigField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Call it a</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    placeholder="session"
                    value={sessionLabel}
                    onChangeText={handleSessionLabelChange}
                  />
                </View>
                <View style={styles.sessionConfigField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                    {sessionLabel || 'session'}s per {cadence ? (cadence.interval === 1 ? cadence.unit : `${cadence.interval} ${cadence.unit}s`) : 'period'}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    keyboardType="number-pad"
                    placeholder="e.g. 5"
                    value={sessionsPerCadence ? String(sessionsPerCadence) : ''}
                    onChangeText={handleSessionsPerCadenceChange}
                  />
                </View>
              </View>
              <View style={styles.sessionConfigRow}>
                <View style={styles.sessionConfigField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                    Each {sessionLabel || 'session'} is
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    keyboardType="number-pad"
                    placeholder="e.g. 15"
                    value={volumePerSession ? String(volumePerSession) : ''}
                    onChangeText={handleVolumePerSessionChange}
                  />
                </View>
                <View style={styles.sessionConfigField}>
                  <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Unit</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.input.background,
                        borderColor: theme.input.border,
                        color: theme.input.text,
                      },
                    ]}
                    placeholderTextColor={theme.input.placeholder}
                    placeholder={
                      standardUnit
                        ? `Default: ${standardUnit}`
                        : 'Unit'
                    }
                    value={unitOverride ?? ''}
                    onChangeText={handleUnitOverrideChange}
                  />
                </View>
              </View>
              {sessionConfigError && (
                <Text style={[styles.errorText, { color: theme.input.borderError }]}>
                  {sessionConfigError}
                </Text>
              )}
            </View>
          )}
        </View>

          {/* Group visibility toggle — only relevant in edit mode */}
          {isEditMode && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setHiddenFromGroup(!hiddenFromGroup)}
                activeOpacity={0.6}
              >
                <Text style={[styles.toggleLabel, { color: theme.text.primary }]}>
                  Visible to group
                </Text>
                <View
                  style={[
                    styles.toggle,
                    {
                      backgroundColor: !hiddenFromGroup ? theme.button.primary.background : theme.input.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      {
                        backgroundColor: theme.background.primary,
                        transform: [{ translateX: !hiddenFromGroup ? 20 : 0 }],
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
              <Text style={[styles.helperText, { color: theme.text.tertiary }]}>
                When off, this standard is hidden from your group members.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.stickyFooter, { backgroundColor: theme.background.chrome, borderTopColor: theme.border.secondary, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {summaryPreview && (
            <Text style={[styles.stickySummary, { color: theme.text.primary }]}>
              {summaryPreview}
            </Text>
          )}
          {saveError && <Text style={[styles.errorText, { color: theme.input.borderError }]}>{saveError}</Text>}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.border.primary }]} onPress={resetForm}>
              <Text style={[styles.secondaryButtonText, { fontSize: typography.button.secondary.fontSize, fontWeight: typography.button.secondary.fontWeight, color: theme.text.primary }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.button.primary.background },
                saving && styles.primaryButtonDisabled,
              ]}
              onPress={() => handleSave()}
              disabled={saving}
            >
              <Text style={[styles.primaryButtonText, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.button.primary.text }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <StandardsLibraryModal
        visible={standardsLibraryVisible}
        onClose={() => setStandardsLibraryVisible(false)}
        onSelectStandard={handleStandardSelect}
      />

      <ArchiveToMakeRoomSheet
        visible={capSheetVisible}
        activeStandards={activeStandards}
        onRequestClose={() => {
          setCapSheetVisible(false);
          setPendingRetry(null);
        }}
        onArchive={async (id) => {
          setCapSheetVisible(false);
          try {
            await archiveStandard(id);
            if (pendingRetry) {
              await pendingRetry();
            }
          } finally {
            setPendingRetry(null);
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    // fontSize and fontWeight come from typography.button.primary
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 64,
  },
  body: {
    flex: 1,
  },
  form: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  stickyFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  stickySummary: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
  },
  selectionCard: {
    padding: 16,
    borderRadius: 10,
    gap: 6,
  },
  selectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  selectionName: {
    fontSize: 20,
    fontWeight: '700',
  },
  selectionMeta: {
    fontSize: 14,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonText: {
    // fontSize and fontWeight come from typography.button.pill
    textTransform: 'capitalize',
  },
  customCadenceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  customIntervalField: {
    flex: 0.4,
    gap: 6,
  },
  customField: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitButtonText: {
    // fontSize and fontWeight come from typography.button.secondary
    textTransform: 'capitalize',
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  alignmentSection: {
    gap: 8,
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
    borderRadius: 8,
  },
  weekdayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alignmentHelperText: {
    fontSize: 13,
  },
  clearAlignmentButton: {
    marginTop: 8,
  },
  clearAlignmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    // fontSize and fontWeight come from typography.button.secondary
  },
  errorText: {
    fontSize: 14,
  },
  minimumUnitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  minimumUnitField: {
    flex: 1,
    gap: 6,
  },
  nameUnitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 2,
    gap: 6,
  },
  unitField: {
    flex: 1,
    gap: 6,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  activitySelectorRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  dropdownContainer: {
    flex: 1,
    position: 'relative',
  },
  activityDropdown: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityDropdownContent: {
    flex: 1,
  },
  selectedActivityContent: {
    gap: 4,
  },
  dropdownChevron: {
    marginLeft: 8,
    transform: [{ rotate: '0deg' }],
  },
  dropdownChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  selectedActivityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedActivityUnit: {
    fontSize: 14,
  },
  dropdownPlaceholder: {
    fontSize: 16,
  },
  createActivityButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createActivityButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  selectedActivityCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedActivityDetails: {
    flex: 1,
    gap: 4,
  },
  selectedActivityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedActivitySubtitle: {
    fontSize: 14,
  },
  activityEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityNotesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  activityNotesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownContent: {
    position: 'absolute',
    maxHeight: 300,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownListContent: {
    paddingVertical: 8,
  },
  dropdownList: {
    maxHeight: 280,
  },
  activityDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityDropdownItemContent: {
    gap: 4,
  },
  activityDropdownItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  activityDropdownItemUnit: {
    fontSize: 14,
  },
  dropdownEmpty: {
    padding: 32,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 14,
    marginTop: 4,
  },
  breakdownSection: {
    marginTop: 16,
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 16,
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionConfigSection: {
    marginTop: 16,
    gap: 12,
  },
  sessionConfigRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionConfigField: {
    flex: 1,
    gap: 6,
  },
  unitHint: {
    fontSize: 12,
    marginTop: 4,
  },
});