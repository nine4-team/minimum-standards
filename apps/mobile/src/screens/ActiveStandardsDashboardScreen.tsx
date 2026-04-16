import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { SETTINGS_TAB_ROUTE_NAME } from '../navigation/types';
import type { Standard } from '@minimum-standards/shared-model';
import { useActiveStandardsDashboard } from '../hooks/useActiveStandardsDashboard';
import type { DashboardStandard } from '../hooks/useActiveStandardsDashboard';
import {
  useStandards,
  ActiveCapExceededError,
} from '../hooks/useStandards';
import { ArchiveToMakeRoomSheet } from '../components/ArchiveToMakeRoomSheet';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { trackStandardEvent } from '../utils/analytics';
import { LogEntryModal } from '../components/LogEntryModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { StandardProgressCard } from '../components/StandardProgressCard';
import { CircularStandardCard } from '../components/CircularStandardCard';
import { BottomSheetMenu } from '../components/BottomSheetMenu';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';
import { useTheme } from '../theme/useTheme';
import { typography, BUTTON_BORDER_RADIUS, CARD_LIST_GAP, SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type SortOption = 'completion' | 'alpha';

export interface StandardsScreenProps {
  onBack?: () => void;
  onLaunchBuilder: () => void;
  onOpenLogModal?: (standard: Standard) => void;
  onNavigateToDetail?: (standardId: string) => void;
  onEditStandard?: (standardId: string) => void;
  backButtonLabel?: string;
}

export function StandardsScreen({
  onBack,
  onLaunchBuilder,
  onOpenLogModal,
  onNavigateToDetail,
  onEditStandard,
  backButtonLabel,
}: StandardsScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('completion');
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const {
    dashboardStandards,
    loading,
    error,
    refreshProgress,
    createLogEntry,
    updateLogEntry,
    refreshStandards,
    archiveStandard,
    nowMs,
  } = useActiveStandardsDashboard();

  const {
    archivedStandards,
    unarchiveStandard,
    deleteStandard,
    deleteLogEntry,
    updateStandard,
    activeStandards,
  } = useStandards();

  // State for inactive standard action menu
  const [inactiveMenuStandard, setInactiveMenuStandard] = useState<Standard | null>(null);
  const [inactiveMenuVisible, setInactiveMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // State for active standard action bottom sheet (T037–T041)
  const [activeMenuStandard, setActiveMenuStandard] = useState<Standard | null>(null);
  const [activeMenuVisible, setActiveMenuVisible] = useState(false);
  const [activeDeactivateConfirmVisible, setActiveDeactivateConfirmVisible] = useState(false);
  const [activeDeleteConfirmVisible, setActiveDeleteConfirmVisible] = useState(false);

  // State for the active-cap archive-to-make-room sheet
  const [capSheetVisible, setCapSheetVisible] = useState(false);
  const [pendingUnarchiveId, setPendingUnarchiveId] = useState<string | null>(null);

  const { showTimeBar, setShowTimeBar, hiddenTimeBarStandardIds, toggleTimeBarForStandard, showInactiveStandards, setShowInactiveStandards, pendingScrollToStandardId, setPendingScrollToStandardId, timeBarFeatureEnabled, standardsLayout } = useUIPreferencesStore();
  const flatListRef = useRef<FlatList<DashboardStandard>>(null);
  const [highlightedStandardId, setHighlightedStandardId] = useState<string | null>(null);

  const handleLogPress = useCallback(
    (entry: DashboardStandard) => {
      trackStandardEvent('dashboard_log_tap', {
        standardId: entry.standard.id,
      });

      if (onOpenLogModal) {
        onOpenLogModal(entry.standard);
      } else {
        setSelectedStandard(entry.standard);
        setLogModalVisible(true);
      }
    },
    [onOpenLogModal]
  );

  const handleLogSave = useCallback(
    async (standardId: string, value: number, occurredAtMs: number, note?: string | null, logEntryId?: string) => {
      if (logEntryId && updateLogEntry) {
        // Edit mode: use updateLogEntry
        await updateLogEntry({ logEntryId, standardId, value, occurredAtMs, note });
      } else {
        // Create mode: use createLogEntry
        await createLogEntry({ standardId, value, occurredAtMs, note });
      }
      // Firestore listener will automatically update the UI
    },
    [createLogEntry, updateLogEntry]
  );

  const handleLogModalClose = useCallback(() => {
    setLogModalVisible(false);
    setSelectedStandard(null);
  }, []);

  const handleRetry = useCallback(() => {
    refreshProgress();
    if (refreshStandards) {
      refreshStandards();
    }
  }, [refreshProgress, refreshStandards]);

  const handleEdit = useCallback((standardId: string) => {
    if (onEditStandard) {
      onEditStandard(standardId);
    }
  }, [onEditStandard]);

  const handleDeactivate = useCallback(async (standardId: string) => {
    try {
      await archiveStandard(standardId);
    } catch (err) {
      Alert.alert('Error', 'Failed to deactivate standard');
      console.error('Failed to deactivate standard:', err);
    }
  }, [archiveStandard]);

  const handleCardPress = useCallback((standardId: string) => {
    // Navigate to current period logs for active standards
    navigation.navigate('StandardPeriodActivityLogs', {
      standardId,
      // No period boundaries - will calculate current period
    });
  }, [navigation]);

  const handleInactiveMenuOpen = useCallback((standard: Standard) => {
    setInactiveMenuStandard(standard);
    setInactiveMenuVisible(true);
  }, []);

  const handleReactivate = useCallback(async (standardId: string) => {
    try {
      await unarchiveStandard(standardId);
    } catch (err) {
      if (err instanceof ActiveCapExceededError) {
        setPendingUnarchiveId(standardId);
        setInactiveMenuVisible(false);
        setCapSheetVisible(true);
        return;
      }
      Alert.alert('Error', 'Failed to reactivate standard');
      console.error('Failed to reactivate standard:', err);
    }
  }, [unarchiveStandard]);

  const handleDeleteStandard = useCallback(async (standardId: string) => {
    try {
      await deleteStandard(standardId);
    } catch (err) {
      Alert.alert('Error', 'Failed to delete standard');
      console.error('Failed to delete standard:', err);
    }
  }, [deleteStandard]);

  // --- Active standard bottom sheet handlers (T037–T041) ---

  const handleActiveMenuOpen = useCallback((standard: Standard) => {
    setActiveMenuStandard(standard);
    setActiveMenuVisible(true);
  }, []);

  const handleActiveEdit = useCallback(() => {
    if (!activeMenuStandard) return;
    setActiveMenuStandard(null);
    handleEdit(activeMenuStandard.id);
  }, [activeMenuStandard, handleEdit]);

  const handleActiveDeactivateConfirm = useCallback(async () => {
    if (!activeMenuStandard) return;
    try {
      await archiveStandard(activeMenuStandard.id);
    } catch (err) {
      Alert.alert('Error', 'Failed to deactivate standard');
      console.error('Failed to deactivate standard:', err);
    }
    setActiveDeactivateConfirmVisible(false);
    setActiveMenuStandard(null);
  }, [activeMenuStandard, archiveStandard]);

  const handleActiveDeleteConfirm = useCallback(async () => {
    if (!activeMenuStandard) return;
    try {
      await deleteStandard(activeMenuStandard.id);
    } catch (err) {
      Alert.alert('Error', 'Failed to delete standard');
      console.error('Failed to delete standard:', err);
    }
    setActiveDeleteConfirmVisible(false);
    setActiveMenuStandard(null);
  }, [activeMenuStandard, deleteStandard]);

  const handleViewInactiveLogs = useCallback((standardId: string) => {
    navigation.navigate('StandardPeriodActivityLogs', {
      standardId,
    });
  }, [navigation]);

  const renderCard = useCallback(
    ({ item }: { item: DashboardStandard }) => {
      const standardId = item.standard.id;
      const isOverriddenForStandard = hiddenTimeBarStandardIds.includes(standardId);
      const effectiveShowTimeBar = timeBarFeatureEnabled
        ? (isOverriddenForStandard ? !showTimeBar : showTimeBar)
        : false;
      return (
        <StandardCard
          entry={item}
          onLogPress={() => handleLogPress(item)}
          onCardPress={() => handleLogPress(item)}
          onMenuPress={() => handleActiveMenuOpen(item.standard)}
          nowMs={nowMs}
          showTimeBar={effectiveShowTimeBar}
          onToggleTimeBar={timeBarFeatureEnabled ? () => toggleTimeBarForStandard(standardId) : undefined}
          highlighted={item.standard.id === highlightedStandardId}
        />
      );
    },
    [
      handleActiveMenuOpen,
      handleLogPress,
      nowMs,
      showTimeBar,
      hiddenTimeBarStandardIds,
      toggleTimeBarForStandard,
      timeBarFeatureEnabled,
      highlightedStandardId,
    ]
  );

  const renderGridCard = useCallback(
    ({ item }: { item: DashboardStandard }) => {
      const { standard, progress } = item;
      return (
        <CircularStandardCard
          standard={standard}
          activityName={standard.name}
          currentTotalFormatted={progress?.currentTotalFormatted ?? '0'}
          targetValueFormatted={Math.round(progress?.targetValue ?? standard.minimum).toString()}
          progressPercent={progress?.progressPercent ?? 0}
          unit={standard.unit}
          periodStartMs={progress?.periodStartMs}
          periodEndMs={progress?.periodEndMs}
          nowMs={nowMs}
          onLogPress={() => handleLogPress(item)}
          onCardPress={() => handleLogPress(item)}
          onMenuPress={() => handleActiveMenuOpen(standard)}
          highlighted={standard.id === highlightedStandardId}
        />
      );
    },
    [handleActiveMenuOpen, handleLogPress, nowMs, highlightedStandardId]
  );

  const sortedAndFilteredStandards = useMemo(() => {
    const sortStandards = (a: DashboardStandard, b: DashboardStandard) => {
      if (sortOption === 'completion') {
        const aProgress = a.progress?.progressPercent ?? 0;
        const bProgress = b.progress?.progressPercent ?? 0;
        return aProgress - bProgress;
      }
      const aName = a.standard.name;
      const bName = b.standard.name;
      return aName.localeCompare(bName);
    };

    return [...dashboardStandards].sort(sortStandards);
  }, [dashboardStandards, sortOption]);

  // Scroll to a newly created standard's card when it appears in the list
  useEffect(() => {
    if (!pendingScrollToStandardId) return;
    const index = sortedAndFilteredStandards.findIndex(
      (entry) => entry.standard.id === pendingScrollToStandardId
    );
    if (index === -1) return; // standard hasn't appeared in data yet; effect will re-run when it does
    setPendingScrollToStandardId(null);
    setHighlightedStandardId(pendingScrollToStandardId);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 300);
    setTimeout(() => {
      setHighlightedStandardId(null);
    }, 2000);
  }, [pendingScrollToStandardId, sortedAndFilteredStandards, setPendingScrollToStandardId]);

  const content = useMemo(() => {
    if (loading && dashboardStandards.length === 0) {
      return (
        <View style={styles.skeletonContainer} testID="dashboard-skeletons">
          {[0, 1, 2].map((key) => (
            <View key={key} style={[styles.skeletonCard, { backgroundColor: theme.background.card }]}>
              <View style={[styles.skeletonLine, { backgroundColor: theme.background.tertiary }]} />
              <View style={[styles.skeletonLineShort, { backgroundColor: theme.background.tertiary }]} />
              <View style={[styles.skeletonBar, { backgroundColor: theme.border.primary }]} />
            </View>
          ))}
        </View>
      );
    }

    if (dashboardStandards.length === 0 && archivedStandards.length === 0) {
      // Truly empty: no active or inactive standards at all
      return (
        <View style={styles.emptyContainer} testID="dashboard-empty-state">
          <MaterialIcons name="flag" size={64} color={theme.text.secondary} />
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No Standards Yet
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.text.secondary }]}>
            Create your first Minimum Standard to start tracking your commitments.
          </Text>
          <TouchableOpacity
            onPress={onLaunchBuilder}
            style={[styles.emptyButton, { backgroundColor: theme.button.primary.background }]}
            accessibilityRole="button"
          >
            <View style={styles.emptyButtonContent}>
              <MaterialIcons name="add" size={20} color={theme.button.primary.text} />
              <Text style={[styles.emptyButtonText, { color: theme.button.primary.text }]}>
                Create Your First Standard
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    if (dashboardStandards.length === 0) {
      // No active standards, but has archived/inactive
      return (
        <View style={styles.emptyContainer} testID="dashboard-empty-state">
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No active standards
          </Text>
          <TouchableOpacity
            onPress={onLaunchBuilder}
            style={[styles.builderButton, { backgroundColor: theme.button.primary.background }]}
            accessibilityRole="button"
          >
            <Text style={[styles.builderButtonText, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.button.primary.text }]}>Create Standard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const isGrid = standardsLayout === 'grid';
    return (
      <FlatList
        ref={flatListRef}
        testID="dashboard-list"
        key={isGrid ? 'grid' : 'list'}
        data={sortedAndFilteredStandards}
        renderItem={isGrid ? renderGridCard : renderCard}
        keyExtractor={(item) => item.standard.id}
        contentContainerStyle={styles.listContent}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        onScrollToIndexFailed={() => {}}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshProgress} />
        }
        ListFooterComponent={
          showInactiveStandards && archivedStandards.length > 0 ? (
            <View style={styles.inactiveSection}>
              <Text style={[styles.inactiveSectionHeader, { color: theme.text.secondary }]}>
                Inactive Standards
              </Text>
              {archivedStandards.map((standard) => {
                const activityName = standard.name;
                const { interval, unit: cadenceUnit } = standard.cadence;
                const cadenceStr = interval === 1 ? cadenceUnit : `${interval} ${cadenceUnit}s`;
                const volumeText = `${standard.minimum} ${standard.unit} / ${cadenceStr}`;

                return (
                  <View key={standard.id} style={styles.inactiveCardWrapper}>
                    <View style={[
                      styles.inactiveCard,
                      {
                        backgroundColor: theme.background.card,
                        borderColor: theme.border.secondary,
                      },
                    ]}>
                      <View style={styles.inactiveCardContent}>
                        <View style={styles.inactiveCardInfo}>
                          <Text
                            style={[styles.inactiveCardName, { color: theme.text.primary }]}
                            numberOfLines={1}
                          >
                            {activityName}
                          </Text>
                          <Text
                            style={[styles.inactiveCardDetail, { color: theme.text.secondary }]}
                            numberOfLines={1}
                          >
                            {volumeText}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleInactiveMenuOpen(standard)}
                          style={styles.inactiveCardMenuButton}
                          accessibilityRole="button"
                          accessibilityLabel={`More options for ${activityName}`}
                        >
                          <MaterialIcons name="more-vert" size={20} color={theme.button.icon.icon} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null
        }
      />
    );
  }, [
    archivedStandards,
    dashboardStandards,
    handleInactiveMenuOpen,
    loading,
    onLaunchBuilder,
    refreshProgress,
    renderCard,
    renderGridCard,
    standardsLayout,
    showInactiveStandards,
    theme,
    sortedAndFilteredStandards,
  ]);

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        {backButtonLabel ? (
          <TouchableOpacity onPress={onBack} accessibilityRole="button">
            <Text style={[styles.backButton, { color: theme.primary.main }]}>{backButtonLabel}</Text>
          </TouchableOpacity>
        ) : timeBarFeatureEnabled ? (
          <TouchableOpacity
            onPress={() => setShowTimeBar(!showTimeBar)}
            style={styles.headerLeftButton}
            accessibilityRole="button"
            accessibilityLabel={showTimeBar ? 'Hide all time bars' : 'Show all time bars'}
          >
            <MaterialIcons name="hourglass-empty" size={24} color={showTimeBar ? theme.button.icon.icon : theme.text.tertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          Standards
        </Text>
        <TouchableOpacity
          onPress={() => setHeaderMenuVisible(true)}
          style={styles.headerMenuButton}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.button.icon.icon} />
        </TouchableOpacity>
      </View>

      <ErrorBanner error={error} onRetry={handleRetry} />

      {content}

      <LogEntryModal
        visible={logModalVisible}
        standard={selectedStandard}
        onClose={handleLogModalClose}
        onSave={handleLogSave}
        onDeleteLogEntry={async (logEntryId, standardId, occurredAtMs) => {
          await deleteLogEntry({ logEntryId, standardId, occurredAtMs });
        }}
      />

      <BottomSheetMenu
        visible={inactiveMenuVisible}
        onRequestClose={() => setInactiveMenuVisible(false)}
        title={inactiveMenuStandard ? inactiveMenuStandard.name : ''}
        items={inactiveMenuStandard ? [
          {
            key: 'reactivate',
            label: 'Reactivate',
            icon: 'replay',
            onPress: () => handleReactivate(inactiveMenuStandard.id),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'delete',
            destructive: true,
            onPress: () => {
              setInactiveMenuVisible(false);
              setDeleteConfirmVisible(true);
            },
          },
          {
            key: 'view-logs',
            label: 'View Logs',
            icon: 'history',
            onPress: () => handleViewInactiveLogs(inactiveMenuStandard.id),
          },
        ] : []}
      />

      <BottomSheetConfirmation
        visible={deleteConfirmVisible}
        onRequestClose={() => setDeleteConfirmVisible(false)}
        title="Delete Standard"
        message="Are you sure you want to delete this standard? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (inactiveMenuStandard) {
            handleDeleteStandard(inactiveMenuStandard.id);
          }
          setDeleteConfirmVisible(false);
          setInactiveMenuStandard(null);
        }}
        onCancel={() => {
          setDeleteConfirmVisible(false);
        }}
      />

      <BottomSheetMenu
        visible={headerMenuVisible}
        onRequestClose={() => setHeaderMenuVisible(false)}
        title="Options"
        items={[
          {
            key: 'sort-completion',
            label: 'Sort by Completion',
            icon: sortOption === 'completion' ? 'check' : undefined,
            onPress: () => setSortOption('completion'),
          },
          {
            key: 'sort-alpha',
            label: 'Sort Alphabetically',
            icon: sortOption === 'alpha' ? 'check' : undefined,
            onPress: () => setSortOption('alpha'),
          },
          {
            key: 'manage-standards',
            label: 'Manage Standards',
            onPress: () => {
              navigation.navigate(
                SETTINGS_TAB_ROUTE_NAME as any,
                { screen: 'StandardsLibrary' } as any
              );
            },
          },
          {
            key: 'show-inactive',
            label: 'Show Inactive Standards',
            icon: showInactiveStandards ? 'check' : undefined,
            onPress: () => setShowInactiveStandards(!showInactiveStandards),
          },
        ]}
      />

      {/* Active standard action bottom sheet (T037) */}
      <BottomSheetMenu
        visible={activeMenuVisible}
        onRequestClose={() => setActiveMenuVisible(false)}
        title={activeMenuStandard ? activeMenuStandard.name : ''}
        items={activeMenuStandard ? [
          {
            key: 'edit',
            label: 'Edit',
            icon: 'edit',
            onPress: handleActiveEdit,
          },
          {
            key: 'deactivate',
            label: 'Deactivate',
            icon: 'archive',
            onPress: () => setActiveDeactivateConfirmVisible(true),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'delete',
            destructive: true,
            onPress: () => setActiveDeleteConfirmVisible(true),
          },
        ] : []}
      />

      {/* Active standard deactivate confirmation (T039) */}
      <BottomSheetConfirmation
        visible={activeDeactivateConfirmVisible}
        onRequestClose={() => {
          setActiveDeactivateConfirmVisible(false);
          setActiveMenuStandard(null);
        }}
        title="Deactivate Standard"
        message="This standard will be moved to inactive. You can reactivate it later from the inactive standards list."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleActiveDeactivateConfirm}
        onCancel={() => {
          setActiveDeactivateConfirmVisible(false);
          setActiveMenuStandard(null);
        }}
      />

      {/* Active standard delete confirmation (T040) */}
      <BottomSheetConfirmation
        visible={activeDeleteConfirmVisible}
        onRequestClose={() => {
          setActiveDeleteConfirmVisible(false);
          setActiveMenuStandard(null);
        }}
        title="Delete Standard"
        message="Are you sure you want to delete this standard? This action cannot be undone. All associated logs will be preserved."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleActiveDeleteConfirm}
        onCancel={() => {
          setActiveDeleteConfirmVisible(false);
          setActiveMenuStandard(null);
        }}
      />

      <ArchiveToMakeRoomSheet
        visible={capSheetVisible}
        activeStandards={activeStandards}
        onRequestClose={() => {
          setCapSheetVisible(false);
          setPendingUnarchiveId(null);
        }}
        onArchive={async (id) => {
          setCapSheetVisible(false);
          const toReactivate = pendingUnarchiveId;
          setPendingUnarchiveId(null);
          try {
            await archiveStandard(id);
            if (toReactivate) {
              await unarchiveStandard(toReactivate, { bypassCap: true });
            }
          } catch (err) {
            Alert.alert('Error', 'Failed to swap active standards');
            console.error(err);
          }
        }}
      />
    </View>
  );
}

function StandardCard({
  entry,
  onLogPress,
  onCardPress,
  onMenuPress,
  nowMs,
  showTimeBar,
  onToggleTimeBar,
  highlighted,
}: {
  entry: DashboardStandard;
  onLogPress: () => void;
  onCardPress?: () => void;
  onMenuPress?: () => void;
  nowMs: number;
  showTimeBar?: boolean;
  onToggleTimeBar?: () => void;
  highlighted?: boolean;
}) {
  const { standard, progress } = entry;

  // Use standard.name directly
  const activityName = standard.name;
  
  // Use period label from progress (computed with windowReferenceMs for auto-advance)
  // Fallback to empty string if progress is null (shouldn't happen in normal flow)
  const periodLabel = progress?.periodLabel ?? '';
  
  // Get numeric summaries
  const currentTotal = progress?.currentTotal ?? 0;
  const targetValue = progress?.targetValue ?? standard.minimum;
  const currentTotalFormatted = progress?.currentTotalFormatted ?? '0';
  const targetValueFormatted = Math.round(targetValue).toString();
  
  const currentSessions = progress?.currentSessions ?? 0;
  const targetSessions = progress?.targetSessions ?? standard.sessionConfig.sessionsPerCadence;
  const sessionLabel = standard.sessionConfig.sessionLabel;
  
  const status = progress?.status ?? 'In Progress';
  const progressPercent = progress?.progressPercent ?? 0;
  const periodStartMs = progress?.periodStartMs;
  const periodEndMs = progress?.periodEndMs;
  const theme = useTheme();

  const card = (
    <StandardProgressCard
      standard={standard}
      activityName={activityName}
      periodLabel={periodLabel}
      currentTotal={currentTotal}
      currentTotalFormatted={currentTotalFormatted}
      targetValue={targetValue}
      targetValueFormatted={targetValueFormatted}
      progressPercent={progressPercent}
      status={status}
      currentSessions={currentSessions}
      targetSessions={targetSessions}
      sessionLabel={sessionLabel}
      unit={standard.unit}
      variant="compact"
      onLogPress={onLogPress}
      onCardPress={onCardPress}
      onMenuPress={onMenuPress}
      periodStartMs={periodStartMs}
      periodEndMs={periodEndMs}
      nowMs={nowMs}
      showTimeBar={showTimeBar}
      onToggleTimeBar={onToggleTimeBar}
    />
  );

  if (highlighted) {
    return (
      <View style={{ borderRadius: 18, borderWidth: 2, borderColor: theme.button.primary.background }}>
        {card}
      </View>
    );
  }

  return card;
}

const styles = StyleSheet.create({
  screen: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 64,
  },
  headerLeftButton: {
    width: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerMenuButton: {
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  skeletonContainer: {
    padding: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  emptyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
  },
  builderButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  builderButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  listContent: {
    padding: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
  },
  gridRow: {
    gap: CARD_LIST_GAP,
  },
  inactiveSection: {
    marginTop: CARD_LIST_GAP,
  },
  inactiveSectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: CARD_LIST_GAP,
  },
  inactiveCardWrapper: {
    opacity: 0.6,
    marginBottom: CARD_LIST_GAP,
  },
  inactiveCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  inactiveCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inactiveCardInfo: {
    flex: 1,
    gap: 2,
  },
  inactiveCardName: {
    fontSize: 16,
    fontWeight: '600',
  },
  inactiveCardDetail: {
    fontSize: 14,
  },
  inactiveCardMenuButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
});
