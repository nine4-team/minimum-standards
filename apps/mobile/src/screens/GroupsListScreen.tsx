import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { useMyGroups, GroupSummary } from '../hooks/useMyGroups';
import { ErrorBanner } from '../components/ErrorBanner';
import * as groupsService from '../services/groupsService';
import type { MemberDashboardData } from '../hooks/useMemberDashboard';
import { SCREEN_PADDING, BUTTON_BORDER_RADIUS, getScreenContainerStyle } from '@nine4/ui-kit';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

interface GroupCardData {
  leaderName: string;
  leaderPct: number;
  groupAvg: number;
}

export function GroupsListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { groups, loading, error } = useMyGroups();
  const [cardData, setCardData] = useState<Record<string, GroupCardData>>({});

  const fetchCardData = useCallback(async () => {
    const results: Record<string, GroupCardData> = {};
    await Promise.all(
      groups.map(async (group) => {
        try {
          const data: MemberDashboardData = await groupsService.getMemberDashboard(group.id);
          if (data.members.length === 0) return;
          const sorted = [...data.members].sort(
            (a, b) => b.stats.avgCompletion - a.stats.avgCompletion
          );
          const groupAvg =
            data.members.reduce((sum, m) => sum + m.stats.avgCompletion, 0) /
            data.members.length;
          results[group.id] = {
            leaderName: sorted[0].displayName,
            leaderPct: sorted[0].stats.avgCompletion,
            groupAvg: Math.round(groupAvg),
          };
        } catch {
          // Silently skip — card will render without leader/avg
        }
      })
    );
    setCardData(results);
  }, [groups]);

  useFocusEffect(
    useCallback(() => {
      if (groups.length > 0) fetchCardData();
    }, [groups, fetchCardData])
  );

  const DIAL_SIZE = 52;
  const DIAL_STROKE = 5;
  const dialRadius = (DIAL_SIZE - DIAL_STROKE) / 2;
  const dialCenter = DIAL_SIZE / 2;
  const dialCircumference = 2 * Math.PI * dialRadius;

  const renderItem = ({ item }: { item: GroupSummary }) => {
    const cd = cardData[item.id];
    const pct = cd ? Math.max(0, Math.min(cd.groupAvg, 100)) : 0;
    const dialOffset = dialCircumference * (1 - pct / 100);
    const dialColor = pct >= 100 ? theme.status.met.barComplete : theme.status.met.bar;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.background.card }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        {cd && (
          <View style={styles.dialContainer}>
            <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
              <G rotation={-90} origin={`${dialCenter}, ${dialCenter}`}>
                <Circle
                  cx={dialCenter}
                  cy={dialCenter}
                  r={dialRadius}
                  stroke={theme.border.secondary}
                  strokeWidth={DIAL_STROKE}
                  fill="none"
                />
                <Circle
                  cx={dialCenter}
                  cy={dialCenter}
                  r={dialRadius}
                  stroke={dialColor}
                  strokeWidth={DIAL_STROKE}
                  strokeLinecap="butt"
                  fill="none"
                  strokeDasharray={`${dialCircumference}, ${dialCircumference}`}
                  strokeDashoffset={dialOffset}
                />
              </G>
            </Svg>
            <Text style={[styles.dialLabel, { color: theme.text.primary }]}>
              {Math.round(pct)}%
            </Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={[styles.groupName, { color: theme.text.primary }]}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <MaterialIcons name="group" size={14} color={theme.text.tertiary} />
            <Text style={[styles.memberCount, { color: theme.text.tertiary }]}>
              {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
            </Text>
            {item.isAdmin && (
              <View style={[styles.adminBadge, { backgroundColor: theme.background.tertiary }]}>
                <Text style={[styles.adminBadgeText, { color: theme.text.secondary }]}>Admin</Text>
              </View>
            )}
          </View>
          {cd && (
            <Text style={[styles.cardLeader, { color: theme.text.secondary }]}>
              Leader: {cd.leaderName} ({cd.leaderPct}%)
            </Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.text.tertiary} />
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
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Groups</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ErrorBanner error={error} />

      {loading && groups.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.activityIndicator} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="group" size={64} color={theme.text.secondary} />
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No Groups Yet
          </Text>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            Create or join a group to hold each other accountable.
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateGroup')}
              style={[styles.primaryButton, { backgroundColor: theme.button.primary.background }]}
            >
              <MaterialIcons name="add" size={18} color={theme.button.primary.text} />
              <Text style={[styles.primaryButtonText, { color: theme.button.primary.text }]}>
                Create Group
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 64 },
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
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyActions: { marginTop: 8, gap: 12, alignItems: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  cardContent: { flex: 1, gap: 4 },
  groupName: { fontSize: 16, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberCount: { fontSize: 13 },
  adminBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '600' },
  dialContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dialLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
  },
  cardLeader: { fontSize: 13, marginTop: 4 },
});
