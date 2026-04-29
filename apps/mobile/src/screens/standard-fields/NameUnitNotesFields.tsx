import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';

export interface NameUnitNotesFieldsProps {
  autoFocusName?: boolean;
}

export function NameUnitNotesFields({ autoFocusName = false }: NameUnitNotesFieldsProps) {
  const theme = useTheme();
  const standardName = useStandardsBuilderStore((s) => s.name);
  const setStandardName = useStandardsBuilderStore((s) => s.setName);
  const standardUnit = useStandardsBuilderStore((s) => s.unit);
  const setStandardUnit = useStandardsBuilderStore((s) => s.setUnit);
  const standardNotes = useStandardsBuilderStore((s) => s.notes);
  const setStandardNotes = useStandardsBuilderStore((s) => s.setNotes);

  return (
    <>
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Name</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
            },
          ]}
          value={standardName}
          onChangeText={setStandardName}
          placeholder="e.g. running, reading, cold calls"
          placeholderTextColor={theme.input.placeholder}
          maxLength={120}
          autoFocus={autoFocusName}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Unit</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
            },
          ]}
          value={standardUnit}
          onChangeText={setStandardUnit}
          placeholder="e.g. minutes, miles, pages, calls"
          placeholderTextColor={theme.input.placeholder}
          autoCorrect={false}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>Notes (optional)</Text>
        <TextInput
          style={[
            styles.notesInput,
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
        />
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
  textInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
  },
  notesInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
