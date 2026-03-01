import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/useTheme';
import { ErrorBanner } from '../components/ErrorBanner';
import { useStandardPeriodActivityLogs } from '../hooks/useStandardPeriodActivityLogs';
import { useStandards } from '../hooks/useStandards';
import { useActivities } from '../hooks/useActivities';
import { StandardPeriodHeader } from '../components/StandardPeriodHeader';
import { ActivityLogsList } from '../components/ActivityLogsList';
import { LogEntryModal } from '../components/LogEntryModal';
import { ActivityLog } from '../hooks/useStandardPeriodActivityLogs';
import { calculatePeriodWindow } from '@minimum-standards/shared-model';

type RouteProps = RouteProp<RootStackParamList, 'StandardPeriodActivityLogs'>;

export function StandardPeriodActivityLogsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { standardId, periodStartMs, periodEndMs, periodStandardSnapshot } = route.params;

  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Modal state for editing logs
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);

  // Get standard and activity information
  const { standards, updateLogEntry, deleteLogEntry } = useStandards();
  const { activities } = useActivities();

  const standard = useMemo(
    () => standards.find(s => s.id === standardId),
    [standards, standardId]
  );

  const activity = useMemo(
    () => activities.find(a => a.id === standard?.activityId),
    [activities, standard?.activityId]
  );

  // Calculate period boundaries and label if not provided
  const periodInfo = useMemo(() => {
    if (periodStartMs && periodEndMs) {
      // Historical period - calculate label
      const snapshotCadence = periodStandardSnapshot?.cadence ?? standard?.cadence;
      const snapshotPreference = periodStandardSnapshot?.periodStartPreference ?? standard?.periodStartPreference;
      if (snapshotCadence) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        const window = calculatePeriodWindow(
          periodStartMs,
          snapshotCadence,
          timezone,
          { periodStartPreference: snapshotPreference }
        );
        return {
          startMs: periodStartMs,
          endMs: periodEndMs,
          label: window.label,
        };
      }
      return null;
    } else if (standard) {
      // Current period - calculate boundaries and label
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const window = calculatePeriodWindow(
        Date.now(),
        standard.cadence,
        timezone,
        { periodStartPreference: standard.periodStartPreference }
      );
      return {
        startMs: window.startMs,
        endMs: window.endMs,
        label: window.label,
      };
    }
    return null;
  }, [periodStartMs, periodEndMs, periodStandardSnapshot, standard]);

  // Fetch activity logs
  const {
    logs,
    loading,
    error,
    hasMore,
    loadMore,
  } = useStandardPeriodActivityLogs(
    standardId,
    periodInfo?.startMs,
    periodInfo?.endMs,
    standard
  );

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRefresh = () => {
    // For now, just re-fetch by triggering a re-render
    // The hook will handle re-fetching
    if (standardId) {
      // This will cause the hook to re-run
    }
  };

  const handleEditLog = (log: ActivityLog) => {
    setEditingLog(log);
    setEditModalVisible(true);
  };

  const handleLogSave = async (
    logStandardId: string,
    value: number,
    occurredAtMs: number,
    note?: string | null,
    logEntryId?: string
  ) => {
    if (logEntryId && updateLogEntry) {
      await updateLogEntry({
        logEntryId,
        standardId: logStandardId,
        value,
        occurredAtMs,
        note,
      });
    }
    // Close modal after save
    setEditModalVisible(false);
    setEditingLog(null);
  };

  const handleModalClose = () => {
    setEditModalVisible(false);
    setEditingLog(null);
  };

  const handleDeleteLog = async (log: ActivityLog) => {
    if (!deleteLogEntry) {
      return;
    }

    try {
      await deleteLogEntry({
        logEntryId: log.id,
        standardId: log.standardId,
        occurredAtMs: log.occurredAtMs,
      });
    } catch (error) {
      console.error('Failed to delete log:', error);
    }
  };

  if (!standard || !activity || !periodInfo) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background.screen }]}>
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
          <TouchableOpacity
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.primary.main} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Activity Logs
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <ErrorBanner error={new Error('Standard or period information not found')} />
      </View>
    );
  }

  // Calculate progress for the header
  const totalValue = logs.reduce((sum, log) => sum + log.value, 0);
  const targetValue = periodStandardSnapshot?.minimum ?? standard.minimum;
  const progressPercent = targetValue > 0 ? Math.min((totalValue / targetValue) * 100, 100) : 0;
  const headerUnit = periodStandardSnapshot?.unit ?? standard.unit;
  const headerSessionConfig = periodStandardSnapshot?.sessionConfig ?? standard.sessionConfig;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background.screen }]}>
      {/* Header */}
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
        <TouchableOpacity 
          onPress={handleBack} 
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.primary.main} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          Activity Logs
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ErrorBanner error={error} />

      {/* Activity Logs with header included */}
      <ActivityLogsList
        logs={logs}
        loading={loading}
        hasMore={hasMore}
        onRefresh={handleRefresh}
        onLoadMore={loadMore}
        onEditLog={handleEditLog}
        onDeleteLog={handleDeleteLog}
        unit={headerUnit}
        periodHeaderProps={{
          periodLabel: periodInfo.label,
          currentTotal: totalValue,
          targetValue,
          unit: headerUnit,
          progressPercent,
          activityName: activity.name,
          sessionConfig: headerSessionConfig,
        }}
      />

      {/* Edit Log Modal */}
      <LogEntryModal
        visible={editModalVisible}
        standard={standard}
        logEntry={editingLog}
        onClose={handleModalClose}
        onSave={handleLogSave}
        resolveActivityName={(activityId) => {
          const activity = activities.find(a => a.id === activityId);
          return activity?.name;
        }}
        currentPeriodStartMs={periodInfo?.startMs}
        currentPeriodEndMs={periodInfo?.endMs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24, // Match back icon width for centering
  },
});