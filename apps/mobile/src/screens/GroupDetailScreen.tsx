import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
// Note: Clipboard requires @react-native-clipboard/clipboard package (not installed yet)
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { useMemberDashboard, MemberDashboardEntry } from '../hooks/useMemberDashboard';
import { firebaseAuth } from '../firebase/firebaseApp';
import * as groupsService from '../services/groupsService';
import { buildGroupJoinUrl } from '../utils/groupLinks';
import { BottomSheetMenu } from '../components/BottomSheetMenu';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';
import { SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

export function GroupDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { groupId } = route.params as { groupId: string };
  const { data, loading, error, refetch } = useMemberDashboard(groupId);
  const currentUid = firebaseAuth.currentUser?.uid;

  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [kickTarget, setKickTarget] = useState<MemberDashboardEntry | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Refetch when screen comes into focus (handles removal/updates while away)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const isAdmin = data?.adminUid === currentUid;

  const handleShareLink = async () => {
    if (data?.inviteCode) {
      const url = buildGroupJoinUrl(data.inviteCode);
      await Share.share({
        message: `Join "${data.groupName}" on Minimum Standards!\n${url}`,
      });
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await groupsService.leaveGroup(groupId);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to leave group.');
    } finally {
      setLeaving(false);
      setLeaveConfirmVisible(false);
    }
  };

  const handleKick = async (targetUid: string) => {
    try {
      await groupsService.removeMember(groupId, targetUid);
      refetch();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove member.');
    }
    setKickTarget(null);
  };

  const renderMember = ({ item }: { item: MemberDashboardEntry }) => {
    const isSelf = item.uid === currentUid;

    return (
      <TouchableOpacity
        style={[styles.memberCard, { backgroundColor: theme.background.card }]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('MemberDashboard', {
            groupId,
            memberUid: item.uid,
            displayName: item.displayName,
          })
        }
        onLongPress={() => {
          if (isAdmin && !isSelf) setKickTarget(item);
        }}
      >
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: theme.text.primary }]}>
              {item.displayName}
            </Text>
            {item.isAdmin && (
              <View style={[styles.adminBadge, { backgroundColor: theme.background.tertiary }]}>
                <Text style={[styles.adminBadgeText, { color: theme.text.secondary }]}>Admin</Text>
              </View>
            )}
            {isSelf && (
              <Text style={[styles.youLabel, { color: theme.text.tertiary }]}>(you)</Text>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {item.stats.metCount}/{item.stats.totalCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>Met</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border.secondary }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {item.stats.streak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border.secondary }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {item.stats.avgCompletion}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>Avg</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.text.tertiary} />
      </TouchableOpacity>
    );
  };

  const menuItems = [
    ...(isAdmin
      ? [
          {
            key: 'invite',
            label: 'Share Invite Link',
            icon: 'share',
            onPress: handleShareLink,
          },
        ]
      : []),
    {
      key: 'leave',
      label: 'Leave Group',
      icon: 'logout',
      destructive: true,
      onPress: () => setLeaveConfirmVisible(true),
    },
  ];

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
          {data?.groupName || 'Group'}
        </Text>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.headerMenuButton}
        >
          <MaterialIcons name="more-horiz" size={24} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      {loading && !data ? (
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
        <FlatList
          data={data.members}
          keyExtractor={(item) => item.uid}
          renderItem={renderMember}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : null}

      <BottomSheetMenu
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
        title={data?.groupName || 'Group'}
        items={menuItems}
      />

      <BottomSheetConfirmation
        visible={leaveConfirmVisible}
        onRequestClose={() => setLeaveConfirmVisible(false)}
        title="Leave Group"
        message={
          isAdmin
            ? 'You are the admin. If you leave, the admin role will be transferred to the next oldest member.'
            : 'Are you sure you want to leave this group?'
        }
        confirmLabel={leaving ? 'Leaving...' : 'Leave'}
        cancelLabel="Cancel"
        destructive
        onConfirm={handleLeave}
        onCancel={() => setLeaveConfirmVisible(false)}
      />

      <BottomSheetConfirmation
        visible={!!kickTarget}
        onRequestClose={() => setKickTarget(null)}
        title="Remove Member"
        message={`Remove ${kickTarget?.displayName || ''} from the group?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => kickTarget && handleKick(kickTarget.uid)}
        onCancel={() => setKickTarget(null)}
      />
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
  headerLeftButton: {
    width: 64,
    alignItems: 'flex-start',
  },
  headerMenuButton: {
    width: 64,
    alignItems: 'flex-end',
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 32,
  },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryText: { fontSize: 15, fontWeight: '600' },
  listContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberInfo: { flex: 1, gap: 8 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 16, fontWeight: '600' },
  youLabel: { fontSize: 13 },
  adminBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 24 },
});
