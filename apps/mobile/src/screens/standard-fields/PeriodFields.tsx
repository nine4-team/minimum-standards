import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Toggle from 'react-native-toggle-element';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CadenceUnit, Weekday } from '@minimum-standards/shared-model';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';
import { CADENCE_PRESETS, isPresetCadence, CadencePreset } from '../../utils/cadenceUtils';

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

export function PeriodFields() {
  const theme = useTheme();
  const cadence = useStandardsBuilderStore((s) => s.cadence);
  const setCadence = useStandardsBuilderStore((s) => s.setCadence);
  const periodStartPreference = useStandardsBuilderStore((s) => s.periodStartPreference);
  const setPeriodStartPreference = useStandardsBuilderStore((s) => s.setPeriodStartPreference);

  const [selectedPreset, setSelectedPreset] = useState<SelectedPreset>(() =>
    deriveInitialPreset(cadence),
  );
  const [customInterval, setCustomInterval] = useState<string>(() =>
    cadence &&
    !isPresetCadence(cadence, 'daily') &&
    !isPresetCadence(cadence, 'weekly') &&
    !isPresetCadence(cadence, 'monthly')
      ? String(cadence.interval)
      : '2',
  );
  const [customUnit, setCustomUnit] = useState<CadenceUnit>(() =>
    cadence &&
    !isPresetCadence(cadence, 'daily') &&
    !isPresetCadence(cadence, 'weekly') &&
    !isPresetCadence(cadence, 'monthly')
      ? cadence.unit
      : 'week',
  );

  const initialWeekday =
    periodStartPreference?.mode === 'weekDay' ? periodStartPreference.weekStartDay : null;
  const [showSpecificDays, setShowSpecificDays] = useState(initialWeekday !== null);
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday | null>(initialWeekday);

  useEffect(() => {
    if (selectedPreset !== 'weekly') {
      setShowSpecificDays(false);
      setSelectedWeekday(null);
      setPeriodStartPreference(null);
    }
  }, [selectedPreset, setPeriodStartPreference]);

  const handlePresetSelect = useCallback(
    (preset: SelectedPreset) => {
      setSelectedPreset(preset);
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

  const handleCustomIntervalChange = useCallback(
    (text: string) => {
      setCustomInterval(text);
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
      const interval = parseInt(customInterval, 10);
      if (!isNaN(interval) && interval > 0) {
        setCadence({ interval, unit });
      }
    },
    [setCadence, customInterval],
  );

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
        setSelectedWeekday(null);
        setPeriodStartPreference(null);
      } else {
        setSelectedWeekday(day);
        setPeriodStartPreference({ mode: 'weekDay', weekStartDay: day });
      }
    },
    [selectedWeekday, setPeriodStartPreference],
  );

  return (
    <>
      <View style={styles.periodOptionsContainer}>
        {PERIOD_OPTIONS.map((option) => {
          const isActive = selectedPreset === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.periodOption,
                {
                  borderColor: isActive ? theme.button.primary.background : theme.border.primary,
                  backgroundColor: isActive ? theme.background.surface : theme.background.chrome,
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

      {selectedPreset === 'custom' && (
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Custom interval</Text>
          <View style={styles.customRow}>
            <Text style={[styles.customInline, { color: theme.text.secondary }]}>Every</Text>
            <TextInput
              style={[
                styles.customInput,
                {
                  color: theme.input.text,
                  borderColor: theme.border.primary,
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
                        backgroundColor: isActive ? theme.background.tertiary : 'transparent',
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

      {selectedPreset === 'weekly' && (
        <>
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
              Set custom start day
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
                        borderColor: isActive
                          ? theme.button.primary.background
                          : theme.border.primary,
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
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  periodOptionsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInline: {
    fontSize: 15,
  },
  customInput: {
    width: 56,
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
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
});
