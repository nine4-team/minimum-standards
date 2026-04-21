import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SuggestorChip } from '../SuggestorChip';

interface ChipRowProps {
  chips: string[];
  onSelect: (chip: string) => void;
  selectedChip?: string | null;
  disabled?: boolean;
}

export function ChipRow({ chips, onSelect, selectedChip, disabled }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => (
        <SuggestorChip
          key={chip}
          label={chip}
          isSelected={selectedChip === chip}
          onPress={() => !disabled && onSelect(chip)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
});
