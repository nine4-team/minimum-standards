import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { ActivityLogEntry } from './ActivityLogEntry';
import { ActivityLog } from '../hooks/useStandardPeriodActivityLogs';
import { useTheme } from '../theme/useTheme';
import { StandardPeriodHeader, StandardPeriodHeaderProps } from './StandardPeriodHeader';
import { CARD_LIST_GAP, SCREEN_PADDING } from '@nine4/ui-kit';

export interface ActivityLogsListProps {
  logs: ActivityLog[];
  loading: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onEditLog?: (log: ActivityLog) => void;
  onDeleteLog?: (log: ActivityLog) => void;
  unit: string;
  periodHeaderProps?: StandardPeriodHeaderProps;
}

export function ActivityLogsList({
  logs,
  loading,
  hasMore,
  onRefresh,
  onLoadMore,
  onEditLog,
  onDeleteLog,
  unit,
  periodHeaderProps,
}: ActivityLogsListProps) {
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to top when logs data is available
    if (flatListRef.current && logs.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [logs]);

  const renderItem = useCallback(({ item }: { item: ActivityLog }) => (
    <ActivityLogEntry
      value={item.value}
      unit={unit}
      occurredAtMs={item.occurredAtMs}
      note={item.note}
      syncStatus={item.syncStatus}
      onEdit={onEditLog ? () => onEditLog(item) : undefined}
      onDelete={onDeleteLog ? () => onDeleteLog(item) : undefined}
    />
  ), [unit, onEditLog, onDeleteLog]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: theme.border.secondary }]}>
        <Text style={styles.emptyIcon}>📝</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
        No activity logs yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
        Log an activity to track progress for this period
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore || !loading) {
      return null;
    }

    return (
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.text.tertiary }]}>
          Loading more...
        </Text>
      </View>
    );
  };

  const keyExtractor = (item: ActivityLog) => item.id;

  const handleEndReached = () => {
    if (hasMore && !loading) {
      onLoadMore();
    }
  };

  return (
    <FlatList
      ref={flatListRef}
      data={logs}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={periodHeaderProps ? <StandardPeriodHeader {...periodHeaderProps} /> : null}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={false} // We handle loading state separately
          onRefresh={onRefresh}
          tintColor={theme.activityIndicator}
        />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.1}
      contentContainerStyle={logs.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: SCREEN_PADDING,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
