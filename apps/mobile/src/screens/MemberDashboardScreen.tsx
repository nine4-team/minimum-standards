import React, { useEffect, useState } from 'react';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import * as groupsService from '../services/groupsService';
import { SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

interface MemberStandard {
  id: string;
  name: string;
  summary: string;
  status: string;
  progressPercent: number;
  total: number;
  minimum: number;
  unit: string;
}

export function MemberDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { groupId, memberUid, displayName } = route.params as {
    groupId: string;
    memberUid: string;
    displayName: string;
  };

  const [standards, setStandards] = useState<MemberStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStandards();
  }, [groupId, memberUid]);

  const loadStandards = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await groupsService.getMemberStandards(groupId, memberUid);
      setStandards(
        result.standards.map((s) => ({
          id: s.id,
          name: s.name,
          summary: s.summary,
          status: s.status,
          progressPercent: s.progressPercent,
          total: s.total,
          minimum: s.minimum,
          unit: s.unit,
        }))
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load member data.');
    } finally {
      setLoading(false);
    }
  };

  const renderStandard = ({ item }: { item: MemberStandard }) => {
    const statusColor =
      item.status === 'Met'
        ? theme.status.met.barComplete
        : item.status === 'In Progress'
        ? theme.status.inProgress.bar
        : theme.status.missed.bar;

    return (
      <TouchableOpacity
        style={[styles.standardCard, { backgroundColor: theme.background.card }]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('MemberStandardDetail', {
            groupId,
            memberUid,
            standardId: item.id,
            standardName: item.name,
          })
        }
      >
        <View style={styles.standardHeader}>
          <Text style={[styles.standardName, { color: theme.text.primary }]}>{item.name}</Text>
          <Text style={[styles.standardSummary, { color: theme.text.tertiary }]}>{item.summary}</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border.secondary }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: statusColor,
                  width: `${Math.min(item.progressPercent, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.text.secondary }]}>
            {Math.round(item.progressPercent)}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
          {displayName}
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
          <TouchableOpacity onPress={loadStandards}>
            <Text style={[styles.retryText, { color: theme.link }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : standards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="visibility" size={48} color={theme.text.tertiary} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {displayName}'s standards will appear here.
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.text.tertiary }]}>
            Standard details are available from the group screen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={standards}
          keyExtractor={(item) => item.id}
          renderItem={renderStandard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8 },
  standardCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  standardHeader: { gap: 2 },
  standardName: { fontSize: 16, fontWeight: '600' },
  standardSummary: { fontSize: 13 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: { fontSize: 13, fontWeight: '600', width: 36, textAlign: 'right' },
});
