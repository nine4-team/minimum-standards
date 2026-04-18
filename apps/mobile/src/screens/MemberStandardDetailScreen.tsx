import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { useMemberStandardDetail, MemberPeriodHistory } from '../hooks/useMemberStandardDetail';
import { SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';

export function MemberStandardDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId, memberUid, standardId, standardName } = route.params as {
    groupId: string;
    memberUid: string;
    standardId: string;
    standardName: string;
  };

  const { data, loading, error, refetch } = useMemberStandardDetail(groupId, memberUid, standardId);

  const statusColor = (status: string) => {
    switch (status) {
      case 'Met':
        return theme.status.met.barComplete;
      case 'In Progress':
        return theme.status.inProgress.bar;
      default:
        return theme.status.missed.bar;
    }
  };

  const renderPeriod = ({ item }: { item: MemberPeriodHistory }) => (
    <View style={[styles.periodCard, { backgroundColor: theme.background.card }]}>
      <View style={styles.periodHeader}>
        <Text style={[styles.periodLabel, { color: theme.text.primary }]}>
          {item.periodLabel || item.periodKey || 'Period'}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'Met'
                  ? theme.status.met.background
                  : item.status === 'In Progress'
                  ? theme.status.inProgress.background
                  : theme.status.missed.background,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  item.status === 'Met'
                    ? theme.status.met.text
                    : item.status === 'In Progress'
                    ? theme.status.inProgress.text
                    : theme.status.missed.text,
              },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>
      <View style={styles.periodStats}>
        <Text style={[styles.periodProgress, { color: theme.text.secondary }]}>
          {item.total} / {item.standardSnapshot?.minimum ?? '—'} {item.standardSnapshot?.unit ?? ''}
        </Text>
        <Text style={[styles.periodSessions, { color: theme.text.tertiary }]}>
          {item.currentSessions}/{item.targetSessions} sessions
        </Text>
      </View>
      <View style={[styles.progressBarBg, { backgroundColor: theme.border.secondary }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: statusColor(item.status),
              width: `${Math.min(item.progressPercent, 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.screen,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeftButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {standardName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.activityIndicator} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.secondary }]}>{error}</Text>
          <TouchableOpacity onPress={refetch}>
            <Text style={[styles.retryText, { color: theme.link }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <>
          {/* Standard summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.background.card }]}>
            <Text style={[styles.summaryName, { color: theme.text.primary }]}>
              {data.standard.name}
            </Text>
            <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
              {data.standard.summary}
            </Text>
          </View>

          {/* Period history */}
          <Text style={[styles.sectionTitle, { color: theme.text.tertiary }]}>
            Period History
          </Text>
          <FlatList
            data={data.history}
            keyExtractor={(item) => item.id}
            renderItem={renderPeriod}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 16 },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.text.tertiary }]}>
                No period history yet.
              </Text>
            }
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerLeftButton: { width: 64, alignItems: 'flex-start' },
  headerSpacer: { width: 64 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 32,
  },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryText: { fontSize: 15, fontWeight: '600' },
  summaryCard: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  summaryName: { fontSize: 18, fontWeight: '700' },
  summaryText: { fontSize: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: 8,
  },
  listContent: { paddingHorizontal: SCREEN_PADDING },
  periodCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodLabel: { fontSize: 15, fontWeight: '600' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  periodStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodProgress: { fontSize: 14 },
  periodSessions: { fontSize: 13 },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 16 },
});
