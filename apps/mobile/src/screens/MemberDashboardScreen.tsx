import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { CircularStandardCard } from '../components/CircularStandardCard';
import { SCREEN_PADDING, CARD_LIST_GAP, getScreenContainerStyle } from '@nine4/ui-kit';
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
  periodStartMs?: number;
  periodEndMs?: number;
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
          periodStartMs: s.periodStartMs,
          periodEndMs: s.periodEndMs,
        }))
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load member data.');
    } finally {
      setLoading(false);
    }
  };

  const nowMs = Date.now();

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
        <ScrollView
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {standards.map((item) => (
            <View key={item.id} style={styles.cell}>
              <CircularStandardCard
                style={{ width: '100%' }}
                standard={{ name: item.name, unit: item.unit, minimum: item.minimum, sessionConfig: undefined as any }}
                activityName={item.name}
                currentTotalFormatted={item.total.toString()}
                targetValueFormatted={Math.round(item.minimum).toString()}
                progressPercent={item.progressPercent}
                unit={item.unit}
                periodStartMs={item.periodStartMs}
                periodEndMs={item.periodEndMs}
                nowMs={nowMs}
              />
            </View>
          ))}
        </ScrollView>
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
  grid: {
    padding: SCREEN_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: CARD_LIST_GAP,
  },
  cell: {
    width: '50%',
  },
});
