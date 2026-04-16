import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Standard } from '@minimum-standards/shared-model';
import { calculatePeriodWindow } from '@minimum-standards/shared-model';
import { useStandardHistory } from '../hooks/useStandardHistory';
import { useStandards, ActiveCapExceededError } from '../hooks/useStandards';
import { ArchiveToMakeRoomSheet } from '../components/ArchiveToMakeRoomSheet';
import { LogEntryModal } from '../components/LogEntryModal';
import { StandardProgressCard } from '../components/StandardProgressCard';
import type { PeriodHistoryEntry } from '../utils/standardHistory';
import { trackStandardEvent } from '../utils/analytics';
import { ErrorBanner } from '../components/ErrorBanner';
import { useTheme } from '../theme/useTheme';
import { BUTTON_BORDER_RADIUS, CARD_LIST_GAP, SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export interface StandardDetailScreenProps {
  standardId: string;
  onBack: () => void;
  onEdit: (standard: Standard) => void;
  onArchive: (standardId: string) => void;
}

export function StandardDetailScreen({
  standardId,
  onBack,
  onEdit,
  onArchive,
}: StandardDetailScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const {
    standards,
    activeStandards,
    createLogEntry,
    updateLogEntry,
    archiveStandard,
    unarchiveStandard,
  } = useStandards();
  const [capSheetVisible, setCapSheetVisible] = useState(false);
  const standard = useMemo(
    () => standards.find((s) => s.id === standardId) ?? null,
    [standards, standardId]
  );

  const { history, loading, error, refresh } = useStandardHistory(standardId);

  // Track screen view on mount
  useEffect(() => {
    if (standard) {
      try {
        trackStandardEvent('standard_detail_view', {
          standardId: standard.id,
        });
      } catch (err) {
        // Fail silently - analytics should not crash the app
        console.warn('Analytics tracking failed:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standard?.id]);

  // Update nowMs every 60 seconds and on app resume
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        setNowMs(Date.now());
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  // Compute current period window to determine which periods are current
  const currentPeriodWindow = useMemo(() => {
    if (!standard) return null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    const nowMs = Date.now();
    return calculatePeriodWindow(nowMs, standard.cadence, timezone, {
      periodStartPreference: standard.periodStartPreference,
    });
  }, [standard]);

  // Compute current period progress
  const currentPeriodProgress = useMemo(() => {
    if (!standard || !currentPeriodWindow) {
      return null;
    }
    // Find the entry that matches the current period window
    const entry = history.find(
      (entry) => entry.periodStartMs === currentPeriodWindow.startMs
    );
    
    // If no entry found, create a default one for the current period
    if (!entry) {
      return {
        periodLabel: currentPeriodWindow.label,
        total: 0,
        target: standard.minimum,
        targetSummary: standard.summary,
        status: 'In Progress' as const,
        progressPercent: 0,
        periodStartMs: currentPeriodWindow.startMs,
        periodEndMs: currentPeriodWindow.endMs,
        currentSessions: 0,
        targetSessions: standard.sessionConfig.sessionsPerCadence,
      };
    }
    
    return entry;
  }, [standard, history, currentPeriodWindow]);

  const handleLogPress = useCallback(() => {
    if (standard) {
      try {
        trackStandardEvent('standard_detail_log_tap', {
          standardId: standard.id,
        });
      } catch (err) {
        // Fail silently - analytics should not crash the app
        console.warn('Analytics tracking failed:', err);
      }
    }
    setLogModalVisible(true);
  }, [standard]);

  const handleLogSave = useCallback(
    async (logStandardId: string, value: number, occurredAtMs: number, note?: string | null, logEntryId?: string) => {
      if (logEntryId && updateLogEntry) {
        // Edit mode: use updateLogEntry
        await updateLogEntry({ logEntryId, standardId: logStandardId, value, occurredAtMs, note });
      } else {
        // Create mode: use createLogEntry
        await createLogEntry({ standardId: logStandardId, value, occurredAtMs, note });
      }
      // History will update automatically via subscription
    },
    [createLogEntry, updateLogEntry]
  );

  const handleLogModalClose = useCallback(() => {
    setLogModalVisible(false);
  }, []);


  const handleEditPress = useCallback(() => {
    if (standard) {
      try {
        trackStandardEvent('standard_detail_edit_tap', {
          standardId: standard.id,
        });
      } catch (err) {
        // Fail silently - analytics should not crash the app
        console.warn('Analytics tracking failed:', err);
      }
      onEdit(standard);
    }
  }, [standard, onEdit]);

  const handleArchivePress = useCallback(async () => {
    if (!standard) return;
    const action = standard.state === 'active' ? 'archive' : 'unarchive';
    try {
      trackStandardEvent('standard_detail_archive_tap', {
        standardId: standard.id,
        action,
      });
    } catch (err) {
      // Fail silently - analytics should not crash the app
      console.warn('Analytics tracking failed:', err);
    }
    if (standard.state === 'active') {
      await archiveStandard(standardId);
      onArchive(standardId);
    } else {
      try {
        await unarchiveStandard(standardId);
        onArchive(standardId);
      } catch (err) {
        if (err instanceof ActiveCapExceededError) {
          setCapSheetVisible(true);
          return;
        }
        throw err;
      }
    }
  }, [standard, standardId, archiveStandard, unarchiveStandard, onArchive]);

  const handleRetry = useCallback(() => {
    refresh();
  }, [refresh]);

  if (loading && history.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background.screen }]}>
        <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary }]}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button">
            <Text style={[styles.backButton, { color: theme.primary.main }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Standard Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.skeletonContainer} testID="detail-skeleton">
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonBar} />
          </View>
        </View>
      </View>
    );
  }

  if (!standard) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background.screen }]}>
        <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary }]}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button">
            <Text style={[styles.backButton, { color: theme.primary.main }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Standard Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>Standard not found</Text>
        </View>
      </View>
    );
  }

  const activityName = standard.name;

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={[styles.backButton, { color: theme.primary.main }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          {activityName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ErrorBanner error={error} onRetry={handleRetry} />

      <ScrollView
        style={[styles.content, { backgroundColor: theme.background.screen }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: 16,
          },
        ]}
      >
        {/* Current Period Summary */}
        {currentPeriodProgress && (
          <StandardProgressCard
            standard={standard}
            activityName={activityName}
            periodLabel={currentPeriodProgress.periodLabel}
            currentTotal={currentPeriodProgress.total}
            currentTotalFormatted={new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(currentPeriodProgress.total)}
            targetValue={currentPeriodProgress.target}
            targetValueFormatted={Math.round(currentPeriodProgress.target).toString()}
            progressPercent={currentPeriodProgress.progressPercent}
            status={currentPeriodProgress.status}
            currentSessions={currentPeriodProgress.currentSessions}
            targetSessions={currentPeriodProgress.targetSessions}
            sessionLabel={standard.sessionConfig.sessionLabel}
            unit={standard.unit}
            showLogButton={true}
            onLogPress={handleLogPress}
            periodStartMs={currentPeriodProgress.periodStartMs}
            periodEndMs={currentPeriodProgress.periodEndMs}
            nowMs={nowMs}
          />
        )}

        {/* History Section */}
        {history.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>History</Text>
            <View style={styles.historyList}>
              {history.map((entry, index) => {
                const isCurrentPeriod = currentPeriodWindow && entry.periodStartMs === currentPeriodWindow.startMs;
                // Skip current period in history since it's shown above
                if (isCurrentPeriod) return null;
                
                return (
                  <StandardProgressCard
                    key={`${entry.periodStartMs}-${entry.periodEndMs}`}
                    standard={standard}
                    activityName={activityName}
                    periodLabel={entry.periodLabel}
                    currentTotal={entry.total}
                    currentTotalFormatted={new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(entry.total)}
                    targetValue={entry.target}
                    targetValueFormatted={Math.round(entry.target).toString()}
                    progressPercent={entry.progressPercent}
                    status={entry.status}
                    currentSessions={entry.currentSessions}
                    targetSessions={entry.targetSessions}
                    sessionLabel={standard.sessionConfig.sessionLabel}
                    unit={standard.unit}
                    showLogButton={false}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyHistoryState}>
            <Text style={[styles.emptyHistoryText, { color: theme.text.secondary }]}>
              No history yet. Start logging to see your progress over time.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            onPress={handleEditPress}
            style={[styles.actionButton, { backgroundColor: theme.button.icon.background }]}
            accessibilityRole="button"
            accessibilityLabel="Edit standard"
          >
            <MaterialIcons name="edit" size={24} color={theme.button.icon.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleArchivePress}
            style={[styles.actionButton, { backgroundColor: theme.button.icon.background }]}
            accessibilityRole="button"
            accessibilityLabel={
              standard.state === 'active' ? 'Deactivate standard' : 'Activate standard'
            }
          >
            <MaterialIcons 
              name={standard.state === 'active' ? 'toggle-off' : 'toggle-on'} 
              size={24} 
              color={theme.button.icon.icon} 
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LogEntryModal
        visible={logModalVisible}
        standard={standard}
        onClose={handleLogModalClose}
        onSave={handleLogSave}
        currentPeriodStartMs={currentPeriodWindow?.startMs}
        currentPeriodEndMs={currentPeriodWindow?.endMs}
      />

      <ArchiveToMakeRoomSheet
        visible={capSheetVisible}
        activeStandards={activeStandards}
        onRequestClose={() => setCapSheetVisible(false)}
        onArchive={async (id) => {
          setCapSheetVisible(false);
          try {
            await archiveStandard(id);
            await unarchiveStandard(standardId, { bypassCap: true });
            onArchive(standardId);
          } catch (err) {
            console.error('Failed to swap active standards', err);
          }
        }}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 64,
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
  },
  skeletonLineShort: {
    height: 16,
    width: '60%',
    borderRadius: 8,
  },
  skeletonBar: {
    height: 4,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
  },
  historySection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  historyList: {
    gap: CARD_LIST_GAP,
  },
  emptyHistoryState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
