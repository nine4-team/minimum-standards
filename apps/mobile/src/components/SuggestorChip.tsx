import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SuggestorChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

export function SuggestorChip({ label, isSelected, onPress }: SuggestorChipProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          borderColor: isSelected
            ? theme.button.primary.background
            : theme.border.primary,
          backgroundColor: isSelected
            ? theme.background.surface
            : theme.background.chrome,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: isSelected ? theme.text.primary : theme.text.secondary,
            fontWeight: isSelected ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
  },
});
