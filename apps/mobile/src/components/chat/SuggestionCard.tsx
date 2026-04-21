import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { StandardSuggestion } from '../../types/suggestor';

interface SuggestionCardProps {
  suggestion: StandardSuggestion;
  isSelected: boolean;
  onPress: () => void;
}

export function SuggestionCard({ suggestion, isSelected, onPress }: SuggestionCardProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isSelected
            ? theme.background.surface
            : theme.background.chrome,
          borderColor: isSelected
            ? theme.button.primary.background
            : theme.border.primary,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.name,
          {
            color: theme.text.primary,
            fontWeight: isSelected ? '600' : '500',
          },
        ]}
      >
        {suggestion.name}
      </Text>
      <Text style={[styles.units, { color: theme.text.secondary }]}>
        {suggestion.units.join(' / ')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    marginBottom: 2,
  },
  units: {
    fontSize: 13,
  },
});
