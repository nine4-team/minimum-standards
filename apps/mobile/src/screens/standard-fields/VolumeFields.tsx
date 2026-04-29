import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Toggle from 'react-native-toggle-element';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';

export function VolumeFields() {
  const theme = useTheme();

  const goalTotal = useStandardsBuilderStore((s) => s.goalTotal);
  const setGoalTotal = useStandardsBuilderStore((s) => s.setGoalTotal);
  const getEffectiveUnit = useStandardsBuilderStore((s) => s.getEffectiveUnit);
  const breakdownEnabled = useStandardsBuilderStore((s) => s.breakdownEnabled);
  const setBreakdownEnabled = useStandardsBuilderStore((s) => s.setBreakdownEnabled);
  const sessionsPerCadence = useStandardsBuilderStore((s) => s.sessionsPerCadence);
  const setSessionsPerCadence = useStandardsBuilderStore((s) => s.setSessionsPerCadence);
  const volumePerSession = useStandardsBuilderStore((s) => s.volumePerSession);
  const setVolumePerSession = useStandardsBuilderStore((s) => s.setVolumePerSession);
  const defaultQuantity = useStandardsBuilderStore((s) => s.defaultQuantity);
  const setDefaultQuantity = useStandardsBuilderStore((s) => s.setDefaultQuantity);

  const [goalTotalText, setGoalTotalText] = useState(
    goalTotal !== null ? String(goalTotal) : '',
  );
  const [sessionsText, setSessionsText] = useState(
    sessionsPerCadence !== null ? String(sessionsPerCadence) : '',
  );
  const [volumePerSessionText, setVolumePerSessionText] = useState(
    volumePerSession !== null ? String(volumePerSession) : '',
  );
  const [defaultQuantityText, setDefaultQuantityText] = useState(
    defaultQuantity !== null ? String(defaultQuantity) : '',
  );

  const effectiveUnit = getEffectiveUnit();

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

  const handleDefaultQuantityChange = useCallback(
    (text: string) => {
      setDefaultQuantityText(text);
      const parsed = parseFloat(text);
      if (text === '' || isNaN(parsed) || parsed <= 0) {
        setDefaultQuantity(null);
      } else {
        setDefaultQuantity(parsed);
      }
    },
    [setDefaultQuantity],
  );

  const handleBreakdownToggle = useCallback(
    (enabled: boolean) => {
      setBreakdownEnabled(enabled);
      if (enabled) {
        setGoalTotalText('');
      } else {
        const currentGoalTotal = useStandardsBuilderStore.getState().goalTotal;
        setGoalTotalText(currentGoalTotal !== null ? String(currentGoalTotal) : '');
      }
    },
    [setBreakdownEnabled],
  );

  const displayGoalTotal = breakdownEnabled
    ? goalTotal !== null
      ? String(goalTotal)
      : ''
    : goalTotalText;

  return (
    <>
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

      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Volume Target</Text>
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

      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
          Default quick-log quantity (optional)
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
          value={defaultQuantityText}
          onChangeText={handleDefaultQuantityChange}
          placeholder={effectiveUnit ? `e.g. 1 ${effectiveUnit}` : 'e.g. 1'}
          placeholderTextColor={theme.input.placeholder}
          keyboardType="numeric"
        />
        <Text style={[styles.fieldHint, { color: theme.text.secondary }]}>
          When set, a "+N" chip on the dashboard logs this amount in one tap.
        </Text>
      </View>
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
  breakdownFields: {
    marginTop: 4,
  },
});
