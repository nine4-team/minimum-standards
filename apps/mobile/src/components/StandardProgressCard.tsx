import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Standard } from '@minimum-standards/shared-model';
import { formatUnitWithCount } from '@minimum-standards/shared-model';

/** Minimal standard shape needed by the card — satisfied by both Standard and ActivityHistoryStandardSnapshot. */
export type StandardProgressCardStandard = Pick<Standard, 'sessionConfig' | 'unit' | 'minimum'>;
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { typography, BUTTON_BORDER_RADIUS, CARD_PADDING, getCardBorderStyle, getCardBaseStyle } from '@nine4/ui-kit';
import { BottomSheetMenu } from './BottomSheetMenu';
import type { BottomSheetMenuItem } from './BottomSheetMenu';

export interface StandardProgressCardProps {
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
  variant?: 'detailed' | 'compact';
  showLogButton?: boolean;
  onLogPress?: () => void;
  onCardPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeactivate?: () => void;
  onViewLogs?: () => void;
  onMenuPress?: () => void;
  periodStartMs?: number;
  periodEndMs?: number;
  nowMs?: number;
}


// Helper function to format time remaining
function formatRemainingLabel(remainingMs: number, durationMs: number): string {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  const FORTY_EIGHT_HOURS_MS = 48 * MS_PER_HOUR;

  if (durationMs < FORTY_EIGHT_HOURS_MS) {
    const remainingH = Math.ceil(remainingMs / MS_PER_HOUR);
    return `${remainingH} hours remaining`;
  } else {
    const remainingDays = remainingMs / MS_PER_DAY;
    const formatted = remainingDays < 10 ? remainingDays.toFixed(1) : Math.round(remainingDays).toString();
    return `${formatted} days remaining`;
  }
}

export function StandardProgressCard({
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
  variant = 'detailed',
  showLogButton = false,
  onLogPress,
  onCardPress,
  onEdit,
  onDelete,
  onDeactivate,
  onViewLogs,
  onMenuPress,
  periodStartMs,
  periodEndMs,
  nowMs,
}: StandardProgressCardProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const isCompact = variant === 'compact';

  // Use green when progress is complete (100%+), otherwise use brown
  const progressBarColor = progressPercent >= 100 ? theme.status.met.barComplete : theme.status.met.bar;
  
  const sessionConfig = standard.sessionConfig;
  const usesSessions = sessionConfig.sessionsPerCadence > 1;

  // Format summaries (derive from standard data)
  const targetUnitText = formatUnitWithCount(standard.unit, standard.minimum);
  const periodSummary = `${currentTotalFormatted} / ${standard.minimum} ${targetUnitText}`;
  
  // Sessions summary (only show if sessionsPerCadence > 1)
  let sessionsSummary: string | null = null;
  if (usesSessions) {
    const sessionLabelPluralForSummary = `${sessionConfig.sessionLabel}s`;
    sessionsSummary = `${currentSessions} / ${sessionConfig.sessionsPerCadence} ${sessionLabelPluralForSummary}`;
  }

  // Compute time progress if period boundaries are provided
  const currentNowMs = nowMs ?? Date.now();
  const shouldShowTimeBar = Boolean(
    periodStartMs !== undefined &&
    periodEndMs !== undefined &&
    periodEndMs > periodStartMs &&
    currentNowMs >= periodStartMs &&
    currentNowMs < periodEndMs
  );

  let timePercent = 0;
  let remainingLabel: string | null = null;

  if (shouldShowTimeBar) {
    const durationMs = periodEndMs - periodStartMs;
    const elapsedMs = Math.max(0, Math.min(currentNowMs - periodStartMs, durationMs));
    const remainingMs = durationMs - elapsedMs;
    timePercent = Math.max(0, Math.min((elapsedMs / durationMs) * 100, 100));
    remainingLabel = formatRemainingLabel(remainingMs, durationMs);
  }

  const handleLogPress = useCallback((e: any) => {
    e.stopPropagation();
    if (onLogPress) onLogPress();
  }, [onLogPress]);

  const handleMenuPress = useCallback((e: any) => {
    e.stopPropagation();
    if (onMenuPress) {
      onMenuPress();
      return;
    }
    setMenuVisible(true);
  }, [onMenuPress]);

  const showMenu = Boolean(onMenuPress || onEdit || onDeactivate || onDelete || onViewLogs);

  const menuItems: BottomSheetMenuItem[] = (() => {
    const items: BottomSheetMenuItem[] = [];
    if (onLogPress && showMenu) {
      items.push({ key: 'log', label: 'Log', onPress: () => onLogPress() });
    }
    if (onViewLogs) {
      items.push({ key: 'view-logs', label: 'View Logs', icon: 'history', onPress: () => onViewLogs() });
    }
    if (onEdit) {
      items.push({ key: 'edit', label: 'Edit', icon: 'edit', onPress: () => onEdit() });
    }
    if (onDeactivate) {
      items.push({ key: 'deactivate', label: 'Deactivate', icon: 'archive', onPress: () => onDeactivate() });
    }
    if (onDelete) {
      items.push({ key: 'delete', label: 'Delete', icon: 'delete', onPress: () => onDelete(), destructive: true });
    }
    return items;
  })();

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          getCardBaseStyle({ radius: 16 }),
          getCardBorderStyle(theme),
          { 
            backgroundColor: theme.background.card, 
            shadowColor: theme.shadow,
            opacity: pressed && onCardPress ? 0.9 : 1
          }
        ]}
        onPress={onCardPress}
        accessibilityRole={onCardPress ? 'button' : undefined}
        accessibilityLabel={onCardPress ? `View details for ${activityName}` : undefined}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text
              style={[styles.activityName, { color: theme.text.primary }]}
              numberOfLines={1}
              accessibilityLabel={`Activity ${activityName}`}
            >
              {activityName}
            </Text>
            {showLogButton && (
              <TouchableOpacity
                onPress={handleLogPress}
                style={[
                  styles.logButtonHeader,
                  { backgroundColor: theme.button.primary.background },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Log progress for ${activityName}`}
              >
                <Text
                  style={[
                    styles.logButtonText,
                    {
                      fontSize: 14,
                      fontWeight: typography.button.primary.fontWeight,
                      color: theme.button.primary.text,
                      includeFontPadding: false,
                      textAlignVertical: 'center',
                    },
                  ]}
                >
                  Log
                </Text>
              </TouchableOpacity>
            )}
            {showMenu && (
              <TouchableOpacity
                onPress={handleMenuPress}
                style={styles.menuButton}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${activityName}`}
              >
                <MaterialIcons name="more-horiz" size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

        <View
          style={[
            styles.progressContainer,
            isCompact && styles.progressContainerCompact,
            { backgroundColor: theme.background.card },
          ]}
        >
          {/* Time progress bar */}
          {shouldShowTimeBar && remainingLabel && (
            <View style={styles.timeBarSection}>
              <View style={styles.progressSummaries}>
                <Text style={[styles.progressSummaryText, { color: theme.text.secondary }]}>
                  {periodLabel}
                </Text>
                <Text style={[styles.progressSummaryText, { color: theme.text.secondary }]}>
                  {remainingLabel}
                </Text>
              </View>
              <View style={styles.progressBarRow}>
                <View style={styles.progressBarLabelRow}>
                  <MaterialIcons name="hourglass-empty" size={10} color={theme.text.secondary} />
                  <Text style={[styles.progressBarLabel, { color: theme.text.secondary }]}>period</Text>
                </View>
                <View style={[styles.progressBar, styles.progressBarRowBar, { backgroundColor: theme.border.secondary }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${timePercent}%`, backgroundColor: theme.text.tertiary },
                    ]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ now: timePercent, min: 0, max: 100 }}
                  />
                </View>
              </View>
            </View>
          )}

          <View style={styles.volumeBarSection}>
            <View style={styles.progressBarRow}>
              <View style={styles.progressBarLabelRow}>
                <MaterialIcons name="bar-chart" size={10} color={progressBarColor} />
                <Text style={[styles.progressBarLabel, { color: progressBarColor }]}>volume</Text>
              </View>
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

    <BottomSheetMenu
      visible={menuVisible}
      onRequestClose={() => setMenuVisible(false)}
      items={menuItems}
    />
    </>
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
  timeBarToggle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  logButtonHeader: {
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  progressContainer: {
    gap: 4,
  },
  progressContainerCompact: {},
  timeBarSection: {
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
  progressBarLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 50,
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
