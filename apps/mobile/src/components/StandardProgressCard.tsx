import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Standard } from '@minimum-standards/shared-model';
import { formatUnitWithCount, UNCATEGORIZED_CATEGORY_ID } from '@minimum-standards/shared-model';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { typography, BUTTON_BORDER_RADIUS, CARD_PADDING, getCardBorderStyle, getCardBaseStyle } from '@nine4/ui-kit';
import { BottomSheetMenu } from './BottomSheetMenu';
import type { BottomSheetMenuItem } from './BottomSheetMenu';

export interface StandardProgressCardProps {
  standard: Standard;
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
  categorizeLabel?: string;
  onCategorize?: () => void;
  categoryOptions?: Array<{ id: string; name: string }>;
  selectedCategoryId?: string;
  onAssignCategoryId?: (categoryId: string) => void | Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeactivate?: () => void;
  onViewLogs?: () => void;
  onMenuPress?: () => void;
  periodStartMs?: number;
  periodEndMs?: number;
  nowMs?: number;
  showTimeBar?: boolean;
}

// Helper function to format time elapsed/remaining
function formatTimeProgress(elapsedMs: number, remainingMs: number, durationMs: number): {
  elapsedLabel: string;
  remainingLabel: string;
} {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  const FORTY_EIGHT_HOURS_MS = 48 * MS_PER_HOUR;

  // Choose unit based on total duration (stable across the period)
  const useHours = durationMs < FORTY_EIGHT_HOURS_MS;

  if (useHours) {
    const elapsedH = Math.floor(elapsedMs / MS_PER_HOUR);
    const remainingH = Math.ceil(remainingMs / MS_PER_HOUR);
    return {
      elapsedLabel: `${elapsedH} hours elapsed`,
      remainingLabel: `${remainingH} hours remaining`,
    };
  } else {
    const elapsedDays = elapsedMs / MS_PER_DAY;
    const remainingDays = remainingMs / MS_PER_DAY;
    
    const formatDays = (days: number): string => {
      if (days < 10) {
        return days.toFixed(1);
      }
      return Math.round(days).toString();
    };

    return {
      elapsedLabel: `${formatDays(elapsedDays)} days elapsed`,
      remainingLabel: `${formatDays(remainingDays)} days remaining`,
    };
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
  categorizeLabel,
  onCategorize,
  categoryOptions,
  selectedCategoryId,
  onAssignCategoryId,
  onEdit,
  onDelete,
  onDeactivate,
  onViewLogs,
  onMenuPress,
  periodStartMs,
  periodEndMs,
  nowMs,
  showTimeBar: showTimeBarProp = true,
}: StandardProgressCardProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [categorizeMenuVisible, setCategorizeMenuVisible] = useState(false);

  const isCompact = variant === 'compact';
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  
  // Use green when progress is complete (100%+), otherwise use brown
  const progressBarColor = progressPercent >= 100 ? theme.status.met.barComplete : theme.status.met.bar;
  
  // Format volume/period: "1800 minutes / week" (derive from standard data)
  const { interval, unit: cadenceUnit } = standard.cadence;
  const cadenceStr = interval === 1 ? cadenceUnit : `${interval} ${cadenceUnit}s`;
  const minimumUnitText = formatUnitWithCount(standard.unit, standard.minimum);
  const volumePeriodText = `${standard.minimum} ${minimumUnitText} / ${cadenceStr}`;
  
  // Format session params: "5 sessions × 15 minutes" (only show if sessionsPerCadence > 1)
  const sessionConfig = standard.sessionConfig;
  const usesSessions = sessionConfig.sessionsPerCadence > 1;
  let sessionParamsText: string | null = null;
  if (usesSessions) {
    const sessionLabelPlural = `${sessionConfig.sessionLabel}s`;
    const sessionVolumeUnit = formatUnitWithCount(standard.unit, sessionConfig.volumePerSession);
    sessionParamsText = `${sessionConfig.sessionsPerCadence} ${sessionLabelPlural} × ${sessionConfig.volumePerSession} ${sessionVolumeUnit}`;
  }
  
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
  let timeLabels: { elapsedLabel: string; remainingLabel: string } | null = null;

  if (shouldShowTimeBar) {
    const durationMs = periodEndMs - periodStartMs;
    const elapsedMs = Math.max(0, Math.min(currentNowMs - periodStartMs, durationMs));
    const remainingMs = durationMs - elapsedMs;
    timePercent = Math.max(0, Math.min((elapsedMs / durationMs) * 100, 100));
    timeLabels = formatTimeProgress(elapsedMs, remainingMs, durationMs);
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

  const showCategorizeSubmenu = Boolean(onAssignCategoryId) && (categoryOptions?.length ?? 0) > 0;
  const showCategorizeAction = Boolean(onCategorize) && !showCategorizeSubmenu;
  const showMenu = Boolean(onMenuPress || showCategorizeSubmenu || showCategorizeAction || onEdit || onDeactivate || onDelete || onViewLogs);

  const menuItems: BottomSheetMenuItem[] = (() => {
    const items: BottomSheetMenuItem[] = [];
    if (onLogPress && showMenu) {
      items.push({ key: 'log', label: 'Log', onPress: () => onLogPress() });
    }
    if (onViewLogs) {
      items.push({ key: 'view-logs', label: 'View Logs', icon: 'history', onPress: () => onViewLogs() });
    }
    if (showCategorizeSubmenu) {
      items.push({ key: 'categorize', label: categorizeLabel ?? 'Category', icon: 'format-list-bulleted', onPress: () => setCategorizeMenuVisible(true) });
    }
    if (showCategorizeAction) {
      items.push({ key: 'categorize-action', label: categorizeLabel ?? 'Category', onPress: () => onCategorize?.() });
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

  const categoryMenuItems: BottomSheetMenuItem[] = (() => {
    if (!categoryOptions) return [];
    return [
      ...categoryOptions.map((c) => ({
        key: c.id,
        label: c.name,
        icon: selectedCategoryId === c.id ? 'check' : undefined,
        onPress: () => onAssignCategoryId?.(c.id),
      })),
      {
        key: UNCATEGORIZED_CATEGORY_ID,
        label: 'Uncategorized',
        icon: selectedCategoryId === UNCATEGORIZED_CATEGORY_ID ? 'check' : undefined,
        onPress: () => onAssignCategoryId?.(UNCATEGORIZED_CATEGORY_ID),
      },
    ];
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
          <View style={[styles.cardHeader, isCompact && styles.cardHeaderCompact]}>
            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.activityName, { color: theme.text.primary }]}
                  numberOfLines={1}
                  accessibilityLabel={`Activity ${activityName}`}
                >
                  {activityName}
                </Text>
                {isCompact && (
                  <TouchableOpacity
                    onPress={(e: any) => {
                      e.stopPropagation();
                      setDetailsExpanded((prev) => !prev);
                    }}
                    style={styles.expandButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      detailsExpanded
                        ? `Hide details for ${activityName}`
                        : `Show details for ${activityName}`
                    }
                  >
                    <MaterialIcons
                      name={detailsExpanded ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={theme.text.secondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {!isCompact && (
                <>
                  <Text
                    style={[styles.volumePeriodText, { color: theme.text.primary }]}
                    numberOfLines={1}
                    accessibilityLabel={`Volume: ${volumePeriodText}`}
                  >
                    {volumePeriodText}
                  </Text>
                  {sessionParamsText !== null && (
                    <Text
                      style={[styles.sessionParamsText, { color: theme.text.secondary }]}
                      numberOfLines={1}
                      accessibilityLabel={`Session params: ${sessionParamsText}`}
                    >
                      {sessionParamsText}
                    </Text>
                  )}
                  <Text
                    style={[styles.dateLine, { color: theme.text.secondary }]}
                    numberOfLines={1}
                    accessibilityLabel={`Period: ${periodLabel}`}
                  >
                    {periodLabel}
                  </Text>
                </>
              )}
              {isCompact && detailsExpanded && (
                <>
                  <Text
                    style={[styles.volumePeriodText, { color: theme.text.primary }]}
                    numberOfLines={1}
                    accessibilityLabel={`Volume: ${volumePeriodText}`}
                  >
                    {volumePeriodText}
                  </Text>
                  {sessionParamsText !== null && (
                    <Text
                      style={[styles.sessionParamsText, { color: theme.text.secondary }]}
                      numberOfLines={1}
                      accessibilityLabel={`Session params: ${sessionParamsText}`}
                    >
                      {sessionParamsText}
                    </Text>
                  )}
                  <Text
                    style={[styles.dateLine, { color: theme.text.secondary }]}
                    numberOfLines={1}
                    accessibilityLabel={`Period: ${periodLabel}`}
                  >
                    {periodLabel}
                  </Text>
                </>
              )}
            </View>
            <View style={[styles.headerActions, isCompact && styles.headerActionsCompact]}>
              <View style={styles.actionButtonsRow}>
                {showLogButton ? (
                  <TouchableOpacity
                    onPress={handleLogPress}
                    style={[
                      styles.logButtonHeader,
                      isCompact && styles.logButtonHeaderCompact,
                      {
                        backgroundColor: theme.button.primary.background,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Log progress for ${activityName}`}
                  >
                    <Text
                      style={[
                        styles.logButtonText,
                        {
                          fontSize: 14, // Slightly smaller than primary for the card header
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
                ) : null}
                {showMenu && (
                      <TouchableOpacity
                      onPress={handleMenuPress}
                      style={styles.menuButton}
                      accessibilityRole="button"
                      accessibilityLabel={`More options for ${activityName}`}
                    >
                      <MaterialIcons name="more-vert" size={20} color={theme.button.icon.icon} />
                    </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

        <View
          style={[
            styles.progressContainer,
            isCompact && styles.progressContainerCompact,
            { backgroundColor: theme.background.card, borderTopColor: theme.border.secondary },
          ]}
        >
          {/* Time progress bar */}
          {showTimeBarProp && shouldShowTimeBar && timeLabels && (
            <>
              <View style={styles.progressSummaries}>
                <Text style={[styles.progressSummaryText, { color: theme.text.secondary }]}>
                  {timeLabels.elapsedLabel}
                </Text>
                <Text style={[styles.progressSummaryText, { color: theme.text.secondary }]}>
                  {timeLabels.remainingLabel}
                </Text>
              </View>
              <View style={styles.progressBarRow}>
                <Text style={[styles.progressBarLabel, { color: theme.text.secondary }]}>t</Text>
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
            </>
          )}

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
    </Pressable>

    <BottomSheetMenu
      visible={menuVisible}
      onRequestClose={() => setMenuVisible(false)}
      items={menuItems}
    />

    {showCategorizeSubmenu && (
      <BottomSheetMenu
        visible={categorizeMenuVisible}
        onRequestClose={() => setCategorizeMenuVisible(false)}
        title="Category"
        items={categoryMenuItems}
      />
    )}
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
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: CARD_PADDING,
  },
  cardHeaderCompact: {
    padding: 12,
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandButton: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    minHeight: 24,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  volumePeriodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionParamsText: {
    fontSize: 13,
  },
  dateLine: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  headerActionsCompact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  logButtonHeader: {
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonHeaderCompact: {
    minHeight: 32,
  },
  logButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  menuButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  progressContainer: {
    padding: CARD_PADDING,
    borderTopWidth: 1,
    gap: 12,
  },
  progressContainerCompact: {
    padding: 12,
    gap: 8,
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
