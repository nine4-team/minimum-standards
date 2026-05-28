import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import * as groupsService from '../services/groupsService';
import type { MemberStandardSummary } from '../services/groupsService';
import { CircularStandardCard } from '../components/CircularStandardCard';
import { SCREEN_PADDING, CARD_LIST_GAP, getScreenContainerStyle } from '@nine4/ui-kit';
import { firebaseAuth } from '../firebase/firebaseApp';
import { importStandardsForUser } from '../utils/snapshotImport';
import type { SnapshotPayloadV2 } from '../types/snapshots';
import type { GroupsStackParamList } from '../navigation/types';
import { StandardsScreen } from './ActiveStandardsDashboardScreen';
import { useStandards } from '../hooks/useStandards';
import { useStandardsBuilderStore } from '../stores/standardsBuilderStore';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

export function MemberDashboardScreen() {
  const route = useRoute();
  const { groupId, memberUid, displayName } = route.params as {
    groupId: string;
    memberUid: string;
    displayName: string;
  };
  const currentUid = firebaseAuth.currentUser?.uid;

  if (memberUid === currentUid) {
    return <SelfMemberStandardsScreen displayName={displayName} />;
  }

  return (
    <OtherMemberDashboardScreen
      groupId={groupId}
      memberUid={memberUid}
      displayName={displayName}
    />
  );
}

function SelfMemberStandardsScreen({ displayName }: { displayName: string }) {
  const navigation = useNavigation<Nav>();
  const { standards } = useStandards();
  const resetBuilder = useStandardsBuilderStore((s) => s.reset);

  const navigateToMainModal = (routeName: 'CreateStandardFlow' | 'EditStandard') => {
    const mainNavigation = navigation.getParent()?.getParent();
    if (mainNavigation) {
      (mainNavigation as any).navigate(routeName);
      return;
    }
    (navigation as any).navigate(routeName);
  };

  return (
    <StandardsScreen
      title={displayName ? `${displayName}'s Standards` : 'My Standards'}
      backButtonLabel="Group"
      onBack={() => navigation.goBack()}
      onLaunchBuilder={() => {
        resetBuilder();
        navigateToMainModal('CreateStandardFlow');
      }}
      onEditStandard={(standardId) => {
        const standard = standards.find((s) => s.id === standardId);
        if (!standard) return;
        useStandardsBuilderStore.getState().loadFromStandard(standard);
        navigateToMainModal('EditStandard');
      }}
    />
  );
}

function OtherMemberDashboardScreen({
  groupId,
  memberUid,
  displayName,
}: {
  groupId: string;
  memberUid: string;
  displayName: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [standards, setStandards] = useState<MemberStandardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadStandards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await groupsService.getMemberStandards(groupId, memberUid);
      setStandards(result.standards);
    } catch (err: any) {
      setError(err?.message || 'Failed to load member data.');
    } finally {
      setLoading(false);
    }
  }, [groupId, memberUid]);

  useEffect(() => {
    loadStandards();
  }, [loadStandards]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleImport = () => {
    const count = selectedIds.size;
    if (count === 0) return;

    Alert.alert(
      'Import Standards',
      `Import ${count} standard${count > 1 ? 's' : ''} from ${displayName}? Duplicates will be skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: doImport },
      ]
    );
  };

  const doImport = async () => {
    const userId = firebaseAuth.currentUser?.uid;
    if (!userId) return;

    const selected = standards.filter((s) => selectedIds.has(s.id));
    const payload: SnapshotPayloadV2 = {
      version: 2,
      standards: selected.map((s) => ({
        id: s.id,
        name: s.name,
        notes: s.notes,
        minimum: s.minimum,
        unit: s.unit,
        cadence: s.cadence,
        sessionConfig: s.sessionConfig ?? {
          sessionLabel: 'session',
          sessionsPerCadence: 1,
          volumePerSession: s.minimum,
        },
        ...(s.periodStartPreference ? { periodStartPreference: s.periodStartPreference as any } : {}),
      })),
    };

    setImporting(true);
    try {
      const result = await importStandardsForUser({ userId, payload });
      exitSelectMode();
      Alert.alert(
        'Done',
        result.createdCount > 0
          ? `${result.createdCount} standard${result.createdCount > 1 ? 's' : ''} imported.`
          : 'All selected standards already exist — nothing new was added.'
      );
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Something went wrong.');
    } finally {
      setImporting(false);
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
        <TouchableOpacity
          onPress={selectMode ? exitSelectMode : () => navigation.goBack()}
          style={styles.headerLeftButton}
        >
          <MaterialIcons
            name={selectMode ? 'close' : 'arrow-back'}
            size={24}
            color={theme.text.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {selectMode ? `${selectedIds.size} selected` : displayName}
        </Text>
        {selectMode ? (
          <TouchableOpacity
            onPress={handleImport}
            disabled={selectedIds.size === 0 || importing}
            style={styles.headerRightButton}
          >
            {importing ? (
              <ActivityIndicator size="small" color={theme.link} />
            ) : (
              <Text
                style={[
                  styles.headerAction,
                  { color: selectedIds.size > 0 ? theme.link : theme.text.tertiary },
                ]}
              >
                Import
              </Text>
            )}
          </TouchableOpacity>
        ) : standards.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSelectMode(true)}
            style={styles.headerRightButton}
          >
            <MaterialIcons name="file-download" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
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
            styles.gridWrapper,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {selectMode && (
            <Text style={[styles.selectHint, { color: theme.text.secondary }]}>
              Tap standards to select them, then import to add them to yours.
            </Text>
          )}
          <View style={styles.grid}>
          {standards.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.cell}
                activeOpacity={selectMode ? 0.7 : 1}
                onPress={selectMode ? () => toggleSelect(item.id) : undefined}
                disabled={!selectMode}
              >
                {selectMode && (
                  <View
                    style={[
                      styles.checkBadge,
                      {
                        backgroundColor: isSelected ? theme.link : theme.background.card,
                        borderColor: isSelected ? theme.link : theme.border.primary,
                      },
                    ]}
                  >
                    {isSelected && (
                      <MaterialIcons name="check" size={14} color="#fff" />
                    )}
                  </View>
                )}
                <CircularStandardCard
                  style={{ width: '100%', ...(selectMode && isSelected ? { opacity: 0.85 } : {}) }}
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
              </TouchableOpacity>
            );
          })}
          </View>
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerLeftButton: { width: 64, alignItems: 'flex-start' },
  headerRightButton: { width: 64, alignItems: 'flex-end', justifyContent: 'center' },
  headerAction: { fontSize: 16, fontWeight: '600' },
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
  gridWrapper: {
    padding: SCREEN_PADDING,
  },
  selectHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: CARD_LIST_GAP,
  },
  cell: {
    width: '50%',
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
