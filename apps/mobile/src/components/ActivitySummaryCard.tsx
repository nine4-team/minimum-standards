import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getCardBaseStyle, getCardBorderStyle } from '@nine4/ui-kit';
import type { ActivitySummaryCard as ActivitySummaryCardData } from '../utils/scorecardSummary';

export interface ActivitySummaryCardProps {
  card: ActivitySummaryCardData;
  onPress: () => void;
}

export function ActivitySummaryCard({ card, onPress }: ActivitySummaryCardProps) {
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
      accessibilityLabel={`View ${card.activityName} scorecard`}
    >
      <View style={styles.titleRow}>
        <Text
          style={[styles.activityName, { color: theme.text.primary }]}
          numberOfLines={1}
        >
          {card.activityName}
        </Text>
        <MaterialIcon name="chevron-right" size={20} color={theme.text.tertiary} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Met</Text>
          <Text style={[styles.statValue, { color: metColor }]}>
            {card.percentMet}%
          </Text>
        </View>

        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Periods</Text>
          <Text style={[styles.statValue, { color: metColor }]} numberOfLines={1}>
            {card.metCount}/{card.completedCount}
          </Text>
        </View>

        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Total</Text>
          <Text style={[styles.statValue, { color: metColor }]} numberOfLines={1}>
            {card.totalVolumeFormatted}
            <Text style={[styles.statUnit, { color: metColor }]}> {card.unit}</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  statCell: {
    gap: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
});
