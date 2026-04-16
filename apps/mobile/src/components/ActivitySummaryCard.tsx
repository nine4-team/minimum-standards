import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getCardBaseStyle, getCardBorderStyle } from '@nine4/ui-kit';
import type { StandardSummaryCard as StandardSummaryCardData } from '../utils/scorecardSummary';

export interface StandardSummaryCardProps {
  card: StandardSummaryCardData;
  onPress: () => void;
}

/**
 * @deprecated Renamed export kept for backwards compatibility.
 * Use StandardSummaryCard instead.
 */
export const ActivitySummaryCard = StandardSummaryCard;
export type ActivitySummaryCardProps = StandardSummaryCardProps;

export function StandardSummaryCard({ card, onPress }: StandardSummaryCardProps) {
  const theme = useTheme();
  const metColor = card.percentMet >= 90 ? theme.status.met.barComplete : theme.status.met.text;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        getCardBaseStyle(),
        getCardBorderStyle(theme),
        { backgroundColor: theme.background.card, shadowColor: theme.shadow },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View ${card.standardName} scorecard`}
    >
      <View style={styles.titleRow}>
        <Text
          style={[styles.standardName, { color: theme.text.primary }]}
          numberOfLines={1}
        >
          {card.standardName}
        </Text>
        <MaterialIcon name="chevron-right" size={20} color={theme.text.tertiary} />
      </View>

      <Text style={[styles.statsLine, { color: metColor }]} numberOfLines={1}>
        {card.percentMet}%
        <Text style={{ color: theme.text.tertiary }}>  ·  </Text>
        {card.metCount}/{card.completedCount}
        <Text style={{ color: theme.text.tertiary }}>  ·  </Text>
        {card.totalVolumeFormatted}
        <Text style={styles.statUnit}> {card.unit}</Text>
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standardName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  statsLine: {
    fontSize: 16,
    fontWeight: '600',
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
});
