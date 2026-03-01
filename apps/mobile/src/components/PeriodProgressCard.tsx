import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import type { StandardProgressCardStandard } from './StandardProgressCard';
import { StandardProgressCard } from './StandardProgressCard';
import { useTheme } from '../theme/useTheme';
import { typography, getCardBaseStyle, getCardBorderStyle, CARD_PADDING } from '@nine4/ui-kit';
import { formatUnitWithCount } from '@minimum-standards/shared-model';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export interface PeriodProgressCardProps {
  standard: StandardProgressCardStandard;
  activityName: string;
  periodLabel: string;
  currentTotal: number;
  currentTotalFormatted: string;
  targetValue: number;
  targetValueFormatted: string;
  progressPercent: number;
  status: 'Met' | 'In Progress' | 'Missed';
  currentSessions: number;
  targetSessions: number;
  sessionLabel: string;
  unit: string;
  onCardPress?: () => void;
  onCardLongPress?: () => void;
}

/**
 * A card for the scorecard detail screen that composes StandardProgressCard
 * and adds the period date range on the header row. Does not modify
 * StandardProgressCard itself.
 */
export function PeriodProgressCard({
  standard,
  activityName,
  periodLabel,
  currentTotal,
  currentTotalFormatted,
  targetValue,
  targetValueFormatted,
  progressPercent,
  status,
  currentSessions,
  targetSessions,
  sessionLabel,
  unit,
  onCardPress,
  onCardLongPress,
}: PeriodProgressCardProps) {
  const theme = useTheme();

  const progressBarColor = progressPercent >= 100 ? theme.status.met.barComplete : theme.status.met.bar;
  const usesSessions = standard.sessionConfig.sessionsPerCadence > 1;
  const targetUnitText = formatUnitWithCount(standard.unit, standard.minimum);
  const periodSummary = `${currentTotalFormatted} / ${standard.minimum} ${targetUnitText}`;

  let sessionsSummary: string | null = null;
  if (usesSessions) {
    const sessionLabelPlural = `${standard.sessionConfig.sessionLabel}s`;
    sessionsSummary = `${currentSessions} / ${standard.sessionConfig.sessionsPerCadence} ${sessionLabelPlural}`;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        getCardBaseStyle({ radius: 16 }),
        getCardBorderStyle(theme),
        {
          backgroundColor: theme.background.card,
          shadowColor: theme.shadow,
          opacity: pressed && onCardPress ? 0.9 : 1,
        },
      ]}
      onPress={onCardPress}
      onLongPress={onCardLongPress}
      accessibilityRole={onCardPress ? 'button' : undefined}
      accessibilityLabel={onCardPress ? `View details for ${activityName}` : undefined}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text
            style={[styles.activityName, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {activityName}
          </Text>
          <Text style={[styles.periodLabel, { color: theme.text.secondary }]}>
            {periodLabel}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.volumeBarSection}>
            <View style={styles.progressBarRow}>
              <Text style={[styles.progressBarLabel, { color: progressBarColor }]}>v</Text>
              <View style={[styles.progressBar, styles.progressBarRowBar, { backgroundColor: theme.border.secondary }]}>
                <View
                  style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: progressBarColor }]}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ now: progressPercent, min: 0, max: 100 }}
                />
              </View>
            </View>
            <View style={styles.progressSummaries}>
              <Text style={[styles.progressSummaryText, { color: progressBarColor }]}>
                {periodSummary}
              </Text>
              {sessionsSummary !== null && (
                <Text style={[styles.progressSummaryText, { color: progressBarColor }]}>
                  {sessionsSummary}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardContent: {
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  activityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  periodLabel: {
    fontSize: 12,
    flexShrink: 0,
  },
  progressContainer: {
    gap: 4,
  },
  volumeBarSection: {
    gap: 4,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBarRowBar: {
    flex: 1,
  },
  progressBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressSummaries: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSummaryText: {
    fontSize: 12,
  },
});
