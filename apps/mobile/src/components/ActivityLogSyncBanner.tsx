import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { useAuthStore } from '../stores/authStore';
import { useActivityLogOperationStore } from '../stores/activityLogOperationStore';
import { ActivityLogOperation } from '../utils/activityLogMutations';

interface ActivityLogSyncBannerProps {
  onRetry: (logEntryId: string) => Promise<void>;
  onDiscard: (logEntryId: string) => void;
  onEdit?: (operation: ActivityLogOperation) => void;
  standardId?: string;
}

export function ActivityLogSyncBanner({
  onRetry,
  onDiscard,
  onEdit,
  standardId,
}: ActivityLogSyncBannerProps) {
  const theme = useTheme();
  const userId = useAuthStore((state) => state.authenticatedUid);
  const operations = useActivityLogOperationStore((state) => state.operationsByLogId);
  const failed = useMemo(
    () =>
      Object.values(operations).filter(
        (operation) =>
          operation.payload.userId === userId &&
          (!standardId || operation.payload.standardId === standardId) &&
          (operation.status === 'failed-retryable' ||
            operation.status === 'failed-permanent' ||
            operation.status === 'conflict')
      ),
    [operations, standardId, userId]
  );

  if (failed.length === 0) {
    return null;
  }

  const retryable = failed.filter(
    (operation) => operation.status === 'failed-retryable'
  );
  const noun = failed.length === 1 ? 'entry' : 'entries';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background.chrome,
          borderColor: theme.border.secondary,
        },
      ]}
      accessibilityRole="alert"
    >
      <MaterialIcons name="sync-problem" size={20} color={theme.text.primary} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {failed.length} {noun} not synced
        </Text>
        <Text style={[styles.message, { color: theme.text.secondary }]} numberOfLines={2}>
          {failed[0].errorMessage ?? 'Review this entry before continuing.'}
        </Text>
      </View>
      {retryable.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry unsynced activity entries"
          onPress={() => {
            retryable.forEach((operation) => {
              onRetry(operation.payload.id).catch(() => undefined);
            });
          }}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: theme.primary.main }]}>Retry</Text>
        </TouchableOpacity>
      )}
      {onEdit && failed.length === 1 && failed[0].kind === 'create' && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Edit unsynced activity entry"
          onPress={() => onEdit(failed[0])}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: theme.primary.main }]}>Edit</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Discard unsynced activity entries"
        onPress={() => failed.forEach((operation) => onDiscard(operation.payload.id))}
        style={styles.action}
      >
        <Text style={[styles.actionText, { color: theme.text.secondary }]}>Discard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
