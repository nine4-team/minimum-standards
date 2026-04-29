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
      <View style={styles.fieldSection}>
        <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Name</Text>
        <TextInput
          style={[
            styles.fieldInput,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
              borderRadius: BUTTON_BORDER_RADIUS,
            },
          ]}
          value={standardName}
          onChangeText={setStandardName}
          placeholder="e.g. Running, Reading, Cold Calls"
          placeholderTextColor={theme.input.placeholder}
          maxLength={120}
          autoFocus={autoFocusName}
        />
      </View>

      <View style={styles.fieldSection}>
        <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Unit</Text>
        <TextInput
          style={[
            styles.fieldInput,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
              borderRadius: BUTTON_BORDER_RADIUS,
            },
          ]}
          value={standardUnit}
          onChangeText={setStandardUnit}
          placeholder="e.g. minutes, miles, pages, calls"
          placeholderTextColor={theme.input.placeholder}
          autoCorrect={false}
        />
      </View>

      <View style={styles.fieldSection}>
        <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Notes (Optional)</Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
              borderRadius: BUTTON_BORDER_RADIUS,
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
  fieldSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
