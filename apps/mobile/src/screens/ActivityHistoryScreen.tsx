import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useActivityHistory } from '../hooks/useActivityHistory';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { useActivityRangeLogs, ActivityLogSlice } from '../hooks/useActivityRangeLogs';
import { useStandards } from '../hooks/useStandards';
import { useActivities } from '../hooks/useActivities';
import { StandardProgressCard } from '../components/StandardProgressCard';
import { ActivityHistoryStatsPanel } from '../components/ActivityHistoryStatsPanel';
import { ActivityVolumeCharts } from '../components/ActivityVolumeCharts';
import { ErrorBanner } from '../components/ErrorBanner';
import { useTheme } from '../theme/useTheme';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { RangeFilterDrawer, TimeRange } from '../components/RangeFilterDrawer';
import { CARD_LIST_GAP, SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import {
  computeSyntheticCurrentRows,
  mergeActivityHistoryRows,
  formatTotal,
  MergedActivityHistoryRow,
} from '../utils/activityHistory';
import { aggregatePeriodStats } from '../utils/scorecardSummary';
import { aggregateDailyVolume, aggregateDailyProgress } from '../utils/activityCharts';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';

export interface ActivityHistoryScreenProps {
  activityId?: string;
  onBack: () => void;
}

const TIME_RANGE_DAYS: Record<TimeRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'All': null,
};

export function ActivityHistoryScreen({
  activityId,
  onBack,
}: ActivityHistoryScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const scrollRef = useRef<ScrollView>(null);
  const cardPositions = useRef<Record<string, number>>({});

  const timeRange = useUIPreferencesStore((s) => s.scorecardTimeRange);
  const setTimeRange = useUIPreferencesStore((s) => s.setScorecardTimeRange);
  const [isRangeDrawerVisible, setIsRangeDrawerVisible] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(activityId ?? null);
  const [isActivitySelectorVisible, setIsActivitySelectorVisible] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());

  const { standards } = useStandards();
  const { activities, loading: activitiesLoading, error: activitiesError } = useActivities();

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => a.name.localeCompare(b.name)),
    [activities]
  );

  useEffect(() => {
    if (activityId) {
      setSelectedActivityId(activityId);
    }
  }, [activityId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setNowMs(Date.now());
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (sortedActivities.length === 0) {
      return;
    }

    // Prefer the activityId prop, then current selection, then first in list
    const preferred = activityId ?? selectedActivityId;
    const isValid = preferred
      ? sortedActivities.some((a) => a.id === preferred)
      : false;

    if (isValid && preferred !== selectedActivityId) {
      setSelectedActivityId(preferred);
    } else if (!isValid) {
      setSelectedActivityId(sortedActivities[0].id);
    }
  }, [sortedActivities, activityId, selectedActivityId]);

  const { rows: persistedRows, loading: historyLoading, error: historyError } = useActivityHistory(selectedActivityId);

  // Get activity name
  const activity = useMemo(
    () => sortedActivities.find((a) => a.id === selectedActivityId) ?? null,
    [sortedActivities, selectedActivityId]
  );
  const activityName = activity?.name ?? 'Select activity';
  const unit = activity?.unit ?? '';

  // Get all standards (active and inactive) that reference this activity
  const relevantStandards = useMemo(
    () => (selectedActivityId ? standards.filter((s) => s.activityId === selectedActivityId) : []),
    [standards, selectedActivityId]
  );

  const relevantStandardIds = useMemo(
    () => relevantStandards.map(s => s.id),
    [relevantStandards]
  );

  const activeStandards = useMemo(
    () =>
      relevantStandards.filter((standard) => standard.state === 'active' && standard.archivedAtMs === null),
    [relevantStandards]
  );

  // Fetch logs for active standards
  const { logs: currentPeriodLogs, loading: logsLoading, error: logsError } = useActivityLogs(
    selectedActivityId,
    relevantStandards,
    timezone
  );

  // Fetch logs for range charts
  const rangeDays = TIME_RANGE_DAYS[timeRange];
  const requestedRangeStartMs = rangeDays ? nowMs - (rangeDays * 24 * 60 * 60 * 1000) : 0;
  const { logs: rangeLogs, loading: rangeLogsLoading, error: rangeLogsError } = useActivityRangeLogs(
    relevantStandardIds,
    requestedRangeStartMs,
    nowMs
  );

  // Compute synthetic current rows
  const syntheticRows = useMemo(() => {
    if (activeStandards.length === 0) {
      return [];
    }
    return computeSyntheticCurrentRows({
      standards: activeStandards,
      activityId: selectedActivityId ?? '',
      logs: currentPeriodLogs,
      timezone,
      nowMs,
    });
  }, [activeStandards, selectedActivityId, currentPeriodLogs, timezone, nowMs]);

  // Merge persisted and synthetic rows — show ALL historical periods regardless
  // of whether the originating standard still exists (fixes deleted-standard hiding)
  const mergedRows = useMemo(() => {
    return mergeActivityHistoryRows({ persistedRows, syntheticRows, timezone, nowMs });
  }, [persistedRows, syntheticRows, timezone, nowMs]);

  const effectiveRangeStartMs = useMemo(() => {
    if (timeRange !== 'All') {
      return requestedRangeStartMs;
    }

    const earliestPeriodStart = mergedRows.length
      ? mergedRows.reduce((min, row) => Math.min(min, row.periodStartMs), Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;

    const earliestLog = rangeLogs.length
      ? rangeLogs.reduce((min, log) => Math.min(min, log.occurredAtMs), Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;

    const candidate = Math.min(earliestPeriodStart, earliestLog);
    if (!isFinite(candidate)) {
      return requestedRangeStartMs;
    }
    return candidate;
  }, [timeRange, requestedRangeStartMs, mergedRows, rangeLogs]);

  // Filtered rows for charts + list based on timeRange (full period totals)
  // Period list includes any periods that overlap the selected range
  const filteredRowsForList = useMemo(() => {
    let result: MergedActivityHistoryRow[];
    if (timeRange === 'All') {
      result = mergedRows;
    } else {
      result = mergedRows.filter(row => row.periodStartMs < nowMs && row.periodEndMs >= requestedRangeStartMs);
    }
    return result;
  }, [mergedRows, timeRange, requestedRangeStartMs, nowMs]);

  const logsByStandard = useMemo(() => {
    const map = new Map<string, ActivityLogSlice[]>();
    rangeLogs.forEach((log) => {
      if (!map.has(log.standardId)) {
        map.set(log.standardId, []);
      }
      map.get(log.standardId)!.push(log);
    });
    map.forEach((logs) => logs.sort((a, b) => a.occurredAtMs - b.occurredAtMs));
    return map;
  }, [rangeLogs]);

  const periodLogsMap = useMemo(() => {
    const map = new Map<number, ActivityLogSlice[]>();
    mergedRows.forEach((row) => map.set(row.periodStartMs, []));

    if (mergedRows.length === 0 || logsByStandard.size === 0) {
      return map;
    }

    const rowsByStandard = new Map<string, MergedActivityHistoryRow[]>();
    mergedRows.forEach((row) => {
      if (!rowsByStandard.has(row.standardId)) {
        rowsByStandard.set(row.standardId, []);
      }
      rowsByStandard.get(row.standardId)!.push(row);
    });

    rowsByStandard.forEach((rows, standardId) => {
      const logs = logsByStandard.get(standardId) ?? [];
      if (rows.length === 0 || logs.length === 0) {
        return;
      }
      rows.sort((a, b) => a.periodStartMs - b.periodStartMs);
      let rowIdx = 0;
      for (const log of logs) {
        while (rowIdx < rows.length && log.occurredAtMs >= rows[rowIdx].periodEndMs) {
          rowIdx += 1;
        }
        if (rowIdx >= rows.length) {
          break;
        }
        const row = rows[rowIdx];
        if (log.occurredAtMs >= row.periodStartMs) {
          map.get(row.periodStartMs)?.push(log);
        }
      }
    });

    return map;
  }, [logsByStandard, mergedRows]);

  const clippedRows = useMemo(() => {
    return filteredRowsForList
      .map((row) => {
        const overlapStart = timeRange === 'All'
          ? row.periodStartMs
          : Math.max(row.periodStartMs, requestedRangeStartMs);
        const overlapEnd = Math.min(row.periodEndMs, nowMs);
        if (overlapEnd <= overlapStart) {
          return null;
        }

        const logs = periodLogsMap.get(row.periodStartMs) ?? [];
        const clippedTotal = logs.reduce((sum, log) => {
          if (log.occurredAtMs >= overlapStart && log.occurredAtMs < overlapEnd) {
            return sum + log.value;
          }
          return sum;
        }, 0);

        return {
          row,
          clippedTotal,
          overlapStartMs: overlapStart,
          overlapEndMs: overlapEnd,
        };
      })
      .filter((entry): entry is {
        row: MergedActivityHistoryRow;
        clippedTotal: number;
        overlapStartMs: number;
        overlapEndMs: number;
      } => entry !== null);
  }, [filteredRowsForList, periodLogsMap, requestedRangeStartMs, nowMs, timeRange]);

  // Aggregate Stats Panel Data
  const stats = useMemo(() => {
    if (clippedRows.length === 0) return null;

    // Use snapshot totals for completed periods, live clipped data for in-progress
    const totalValueRaw = clippedRows.reduce((sum, entry) => {
      return sum + (entry.row.isCurrentPeriod ? entry.clippedTotal : entry.row.total);
    }, 0);

    const clippedMergedRows = clippedRows.map((entry) => entry.row);
    const { completedCount, metCount } = aggregatePeriodStats(clippedMergedRows);
    const percentMet = completedCount > 0 ? Math.round((metCount / completedCount) * 100) : 0;

    // Standard Change logic - use all mergedRows to find full history
    const standardsHistory = [...mergedRows]
      .reverse() // Oldest first
      .map(row => row.standardSnapshot.minimum)
      .filter((val, index, self) => index === 0 || val !== self[index - 1]);

    let standardChange = 'No changes yet';
    if (standardsHistory.length > 1) {
      const first = standardsHistory[0];
      const latest = standardsHistory[standardsHistory.length - 1];
      standardChange = `${formatTotal(first)} ➝ ${formatTotal(latest)}`;
    }

    return {
      totalValue: formatTotal(totalValueRaw),
      percentMet,
      countMet: `${metCount} / ${completedCount} periods`,
      standardChange,
      standardHistory: standardsHistory.reverse(), // For the drill-down, latest first
    };
  }, [mergedRows, clippedRows]);

  // Aggregate Chart Data
  const chartData = useMemo(() => {
    if (filteredRowsForList.length === 0) return null;

    const dailyVolume = aggregateDailyVolume(rangeLogs, effectiveRangeStartMs, nowMs, timezone);
    
    const dailyProgress = aggregateDailyProgress(
      rangeLogs,
      filteredRowsForList.map((r) => ({
        startMs: r.periodStartMs,
        endMs: r.periodEndMs,
        goal: r.standardSnapshot.minimum,
      })),
      timezone,
      { nowMs }
    );

    // Period Progress: show all filtered periods, not just last 15
    // For very long histories, consider pagination/lazy loading in the future
    const periodProgress = filteredRowsForList.slice().reverse().map(r => ({
      label: r.periodLabel,
      actual: r.total,
      goal: r.standardSnapshot.minimum,
      status: r.status,
      periodStartMs: r.periodStartMs,
    }));

    // Standards Progress: use actual standard change points, not just period labels
    // Build from deduplicated standard history with effective dates
    const standardsHistoryMap = new Map<number, number>(); // periodStartMs -> minimum
    filteredRowsForList.forEach(r => {
      const existing = standardsHistoryMap.get(r.periodStartMs);
      if (!existing || r.standardSnapshot.minimum !== existing) {
        standardsHistoryMap.set(r.periodStartMs, r.standardSnapshot.minimum);
      }
    });
    
    const standardsProgress = Array.from(standardsHistoryMap.entries())
      .sort((a, b) => a[0] - b[0]) // Sort by period start
      .map(([periodStartMs, value]) => {
        const row = filteredRowsForList.find(r => r.periodStartMs === periodStartMs);
        return {
          label: row?.periodLabel || new Date(periodStartMs).toLocaleDateString(),
          value,
          periodStartMs,
        };
      });

    // Cumulative Volume: accumulate daily volume over time
    let cumulativeTotal = 0;
    const cumulativeVolume = dailyVolume.map((day) => {
      cumulativeTotal += day.value;
      return {
        label: day.label,
        value: cumulativeTotal,
        date: day.date,
        timestamp: day.timestamp,
      };
    });

    return {
      dailyVolume,
      dailyProgress,
      periodProgress,
      standardsProgress,
      cumulativeVolume,
    };
  }, [filteredRowsForList, rangeLogs, effectiveRangeStartMs, nowMs, timezone]);

  const loading = activitiesLoading || historyLoading || logsLoading || (rangeLogsLoading && mergedRows.length === 0);
  const error = historyError || logsError || rangeLogsError || activitiesError;

  useEffect(() => {
    if (rangeLogsError) {
      console.error('ActivityHistoryScreen range logs error:', rangeLogsError);
    }
  }, [rangeLogsError]);

  // Handle period card press - navigate to period activity logs
  const handlePeriodPress = (row: MergedActivityHistoryRow) => {
    navigation.navigate('StandardPeriodActivityLogs', {
      standardId: row.standardId,
      activityId: selectedActivityId ?? undefined,
      periodStartMs: row.periodStartMs,
      periodEndMs: row.periodEndMs,
      periodStandardSnapshot: row.standardSnapshot,
    });
  };

  const handleSelectPeriod = (periodStartMs: number) => {
    const y = cardPositions.current[periodStartMs.toString()];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: y - 10, animated: true });
    }
  };

  const hasActivities = sortedActivities.length > 0;

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.chrome,
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={[styles.backButton, { color: theme.primary.main }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Scorecard Detail</Text>
        <TouchableOpacity 
          onPress={() => setIsRangeDrawerVisible(true)}
          style={[styles.rangeTrigger, { backgroundColor: theme.background.surface, borderColor: theme.border.primary }]}
        >
          <MaterialIcon name="event" size={16} color={theme.primary.main} />
          <Text style={[styles.rangeTriggerText, { color: theme.text.primary }]}>{timeRange}</Text>
        </TouchableOpacity>
      </View>

      <RangeFilterDrawer
        visible={isRangeDrawerVisible}
        onClose={() => setIsRangeDrawerVisible(false)}
        selectedRange={timeRange}
        onSelectRange={setTimeRange}
      />

      <ErrorBanner error={error} />

      <View style={[styles.selectorSection, { borderBottomColor: theme.border.secondary }]}>
        <Text style={[styles.selectorTitle, { color: theme.text.secondary }]}>Activity</Text>
        <TouchableOpacity
          style={[styles.selectorButton, { backgroundColor: theme.input.background, borderColor: theme.input.border }]}
          onPress={() => {
            if (hasActivities) {
              setIsActivitySelectorVisible(true);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Select activity"
        >
          <View style={styles.selectorTextBlock}>
            <Text style={[styles.selectorValue, { color: theme.text.primary }]}>
              {activityName}
            </Text>
            {!!unit && (
              <Text style={[styles.selectorUnit, { color: theme.text.secondary }]}>{unit}</Text>
            )}
          </View>
          <MaterialIcon name="keyboard-arrow-down" size={22} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      {!hasActivities && !activitiesLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No activities yet. Create one in Standards to get started.
          </Text>
        </View>
      ) : loading && mergedRows.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.activityIndicator} />
        </View>
      ) : mergedRows.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No history yet. Period rows appear after the next cadence boundary.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={[styles.content, { backgroundColor: theme.background.screen }]}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {stats && (
            <ActivityHistoryStatsPanel
              totalValue={stats.totalValue}
              unit={unit}
              percentMet={stats.percentMet}
              countMet={stats.countMet}
              standardChange={stats.standardChange}
              standardHistory={stats.standardHistory}
              isLoading={loading}
              hasData={rangeLogs.length > 0 || clippedRows.length > 0}
            />
          )}

          {chartData && (
            <ActivityVolumeCharts
              dailyVolume={chartData.dailyVolume}
              dailyProgress={chartData.dailyProgress}
              periodProgress={chartData.periodProgress}
              standardsProgress={chartData.standardsProgress}
              cumulativeVolume={chartData.cumulativeVolume}
              unit={unit}
              onSelectPeriod={handleSelectPeriod}
            />
          )}

          {filteredRowsForList.some((r) => r.isCurrentPeriod) && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Current Period</Text>
              {filteredRowsForList
                .filter((r) => r.isCurrentPeriod)
                .map((row) => (
                  <View
                    key={`${row.standardId}__${row.periodStartMs}`}
                    onLayout={(e) => {
                      cardPositions.current[row.periodStartMs.toString()] = e.nativeEvent.layout.y;
                    }}
                  >
                    <StandardProgressCard
                      standard={row.standardSnapshot}
                      activityName={activityName}
                      periodLabel={row.periodLabel}
                      currentTotal={row.total}
                      currentTotalFormatted={formatTotal(row.total)}
                      targetValue={row.standardSnapshot.minimum}
                      targetValueFormatted={formatTotal(row.standardSnapshot.minimum)}
                      unit={row.standardSnapshot.unit}
                      progressPercent={row.progressPercent}
                      status={row.status}
                      currentSessions={row.currentSessions}
                      targetSessions={row.targetSessions}
                      sessionLabel={row.standardSnapshot.sessionConfig.sessionLabel}
                      onCardPress={() => handlePeriodPress(row)}
                    />
                  </View>
                ))}
            </>
          )}

          {filteredRowsForList.some((r) => !r.isCurrentPeriod) && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>History</Text>
              {filteredRowsForList
                .filter((r) => !r.isCurrentPeriod)
                .map((row) => (
                  <View
                    key={`${row.standardId}__${row.periodStartMs}`}
                    onLayout={(e) => {
                      cardPositions.current[row.periodStartMs.toString()] = e.nativeEvent.layout.y;
                    }}
                  >
                    <StandardProgressCard
                      standard={row.standardSnapshot}
                      activityName={activityName}
                      periodLabel={row.periodLabel}
                      currentTotal={row.total}
                      currentTotalFormatted={formatTotal(row.total)}
                      targetValue={row.standardSnapshot.minimum}
                      targetValueFormatted={formatTotal(row.standardSnapshot.minimum)}
                      unit={row.standardSnapshot.unit}
                      progressPercent={row.progressPercent}
                      status={row.status}
                      currentSessions={row.currentSessions}
                      targetSessions={row.targetSessions}
                      sessionLabel={row.standardSnapshot.sessionConfig.sessionLabel}
                      onCardPress={() => handlePeriodPress(row)}
                    />
                  </View>
                ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={isActivitySelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsActivitySelectorVisible(false)}
      >
        <Pressable
          style={[styles.selectorOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setIsActivitySelectorVisible(false)}
        >
          <Pressable
            style={[styles.selectorSheet, { backgroundColor: theme.background.modal }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.selectorSheetTitle, { color: theme.text.primary }]}>Select activity</Text>
            <FlatList
              data={sortedActivities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedActivityId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectorItem,
                      isSelected && { backgroundColor: theme.background.tertiary },
                    ]}
                    onPress={() => {
                      setSelectedActivityId(item.id);
                      setIsActivitySelectorVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <View style={styles.selectorItemText}>
                      <Text style={[styles.selectorItemName, { color: theme.text.primary }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.selectorItemUnit, { color: theme.text.secondary }]}>
                        {item.unit}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcon name="check" size={20} color={theme.primary.main} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60, // Match back button width for centering
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
  },
  selectorSection: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING,
    borderBottomWidth: 1,
    gap: 8,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorTextBlock: {
    gap: 2,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectorUnit: {
    fontSize: 12,
  },
  selectorOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    padding: SCREEN_PADDING,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  selectorSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectorItemText: {
    gap: 4,
  },
  selectorItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectorItemUnit: {
    fontSize: 12,
  },
  rangeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  rangeTriggerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
});

