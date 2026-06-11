import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Standard } from '@minimum-standards/shared-model';
import { useActiveStandardsDashboard } from '../hooks/useActiveStandardsDashboard';
import type { DashboardStandard } from '../hooks/useActiveStandardsDashboard';
import {
  useStandards,
} from '../hooks/useStandards';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useQuickLog } from '../hooks/useQuickLog';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { trackStandardEvent } from '../utils/analytics';
import { LogEntryModal } from '../components/LogEntryModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { CircularStandardCard } from '../components/CircularStandardCard';
import { BottomSheetMenu } from '../components/BottomSheetMenu';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';
import { DraggableStandardsGrid } from '../components/DraggableStandardsGrid';
import { useTheme } from '../theme/useTheme';
import { BUTTON_BORDER_RADIUS, CARD_LIST_GAP, SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  buildDashboardPages,
  buildPlacementUpdates,
  getVisiblePageDotIndexes,
  moveStandardToPage,
  reorderPageStandards,
} from '../utils/dashboardPages';

export interface StandardsScreenProps {
  onBack?: () => void;
  onLaunchBuilder: () => void;
  onOpenLogModal?: (standard: Standard) => void;
  onNavigateToDetail?: (standardId: string) => void;
  onEditStandard?: (standardId: string) => void;
  onOrganizeStandards?: () => void;
  backButtonLabel?: string;
  title?: string;
}

export function StandardsScreen({
  onBack,
  onLaunchBuilder,
  onOpenLogModal,
  onNavigateToDetail,
  onEditStandard,
  onOrganizeStandards,
  backButtonLabel,
  title = 'Standards',
}: StandardsScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [logModalVisible, setLogModalVisible] = useState(false);
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
    deleteStandard,
    deleteLogEntry,
    updateStandard,
  } = useStandards();
  const {
    layout,
    loading: layoutLoading,
    saveLayoutAndPlacements,
  } = useDashboardLayout();

  // State for active standard action bottom sheet (T037–T041)
  const [activeMenuStandard, setActiveMenuStandard] = useState<Standard | null>(null);
  const [activeMenuVisible, setActiveMenuVisible] = useState(false);
  const [activeDeactivateConfirmVisible, setActiveDeactivateConfirmVisible] = useState(false);
  const [activeDeleteConfirmVisible, setActiveDeleteConfirmVisible] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const { pendingScrollToStandardId, setPendingScrollToStandardId } = useUIPreferencesStore();
  const [highlightedStandardId, setHighlightedStandardId] = useState<string | null>(null);

  // Quick-log chip: per-card undo window. Maps standardId -> {logEntryId, occurredAtMs}.
  const { quickLog, undoQuickLog } = useQuickLog();
  const [pendingUndo, setPendingUndo] = useState<
    Record<string, { logEntryId: string; occurredAtMs: number }>
  >({});
  const undoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const QUICK_LOG_UNDO_MS = 4000;

  const clearUndoTimer = useCallback((standardId: string) => {
    const timer = undoTimers.current[standardId];
    if (timer) {
      clearTimeout(timer);
      delete undoTimers.current[standardId];
    }
  }, []);

  const dismissUndo = useCallback(
    (standardId: string) => {
      clearUndoTimer(standardId);
      setPendingUndo((prev) => {
        if (!(standardId in prev)) return prev;
        const next = { ...prev };
        delete next[standardId];
        return next;
      });
    },
    [clearUndoTimer]
  );

  useEffect(() => {
    return () => {
      Object.values(undoTimers.current).forEach((timer) => clearTimeout(timer));
      undoTimers.current = {};
    };
  }, []);

  const handleQuickLog = useCallback(
    async (standard: Standard) => {
      try {
        const result = await quickLog(standard);
        if (!result) return;
        clearUndoTimer(standard.id);
        setPendingUndo((prev) => ({
          ...prev,
          [standard.id]: {
            logEntryId: result.logEntryId,
            occurredAtMs: result.occurredAtMs,
          },
        }));
        undoTimers.current[standard.id] = setTimeout(() => {
          dismissUndo(standard.id);
        }, QUICK_LOG_UNDO_MS);
        trackStandardEvent('dashboard_quick_log', { standardId: standard.id });
      } catch (err) {
        Alert.alert('Error', 'Failed to log entry');
        console.error('Quick log failed:', err);
      }
    },
    [quickLog, clearUndoTimer, dismissUndo]
  );

  const handleQuickLogUndo = useCallback(
    async (standardId: string) => {
      const pending = pendingUndo[standardId];
      if (!pending) return;
      dismissUndo(standardId);
      try {
        await undoQuickLog(standardId, pending.logEntryId, pending.occurredAtMs);
      } catch (err) {
        Alert.alert('Error', 'Failed to undo log');
        console.error('Quick log undo failed:', err);
      }
    },
    [pendingUndo, dismissUndo, undoQuickLog]
  );

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

  const renderCard = useCallback(
    (item: DashboardStandard, isDragging: boolean) => {
      const { standard, progress } = item;
      return (
        <CircularStandardCard
          style={{ width: '100%', opacity: isDragging ? 0.3 : 1 }}
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
          defaultQuantity={standard.defaultQuantity}
          onQuickLogPress={() => handleQuickLog(standard)}
          quickLogUndoVisible={Boolean(pendingUndo[standard.id])}
          onQuickLogUndoPress={() => handleQuickLogUndo(standard.id)}
        />
      );
    },
    [
      handleActiveMenuOpen,
      handleLogPress,
      nowMs,
      highlightedStandardId,
      pendingUndo,
      handleQuickLog,
      handleQuickLogUndo,
    ]
  );

  // Sort by orderIndex if set (user has dragged), otherwise alphabetical
  const sortedAndFilteredStandards = useMemo(() => {
    return [...dashboardStandards].sort((a, b) => {
      const aIdx = a.standard.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const bIdx = b.standard.orderIndex ?? Number.MAX_SAFE_INTEGER;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.standard.name.localeCompare(b.standard.name);
    });
  }, [dashboardStandards]);

  const dashboardStandardMap = useMemo(
    () =>
      new Map(
        sortedAndFilteredStandards.map((entry) => [entry.standard.id, entry])
      ),
    [sortedAndFilteredStandards]
  );

  const standardPages = useMemo(
    () =>
      buildDashboardPages(
        sortedAndFilteredStandards.map((entry) => entry.standard),
        layout
      ),
    [layout, sortedAndFilteredStandards]
  );

  const dashboardPages = useMemo(
    () =>
      standardPages.map((page) => ({
        ...page,
        items: page.standards
          .map((standard) => dashboardStandardMap.get(standard.id))
          .filter((entry): entry is DashboardStandard => Boolean(entry)),
      })),
    [dashboardStandardMap, standardPages]
  );

  const currentPage = dashboardPages[
    Math.min(activePageIndex, Math.max(dashboardPages.length - 1, 0))
  ];

  useEffect(() => {
    if (activePageIndex <= dashboardPages.length - 1) return;
    setActivePageIndex(Math.max(dashboardPages.length - 1, 0));
  }, [activePageIndex, dashboardPages.length]);

  useEffect(() => {
    pagerRef.current?.scrollTo({
      x: activePageIndex * windowWidth,
      animated: true,
    });
  }, [activePageIndex, windowWidth]);

  const handleReorder = useCallback(
    async (pageId: string, orderedIds: string[]) => {
      try {
        const nextPages = reorderPageStandards(standardPages, pageId, orderedIds);
        await saveLayoutAndPlacements(
          nextPages.map(({ standards: _standards, ...page }) => page),
          buildPlacementUpdates(nextPages)
        );
      } catch (err) {
        Alert.alert('Error', 'Failed to save order');
        console.error('Failed to save order:', err);
      }
    },
    [saveLayoutAndPlacements, standardPages]
  );

  const handleMoveStandardToPage = useCallback(
    async (standardId: string, targetPageId: string) => {
      const result = moveStandardToPage(standardPages, standardId, targetPageId);
      if (result.error) {
        Alert.alert('Page full', result.error);
        return;
      }
      try {
        await saveLayoutAndPlacements(
          result.pages.map(({ standards: _standards, ...page }) => page),
          buildPlacementUpdates(result.pages)
        );
        const nextPageIndex = result.pages.findIndex((page) => page.id === targetPageId);
        if (nextPageIndex >= 0) {
          setActivePageIndex(nextPageIndex);
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to move standard');
        console.error('Failed to move standard:', err);
      }
    },
    [saveLayoutAndPlacements, standardPages]
  );

  // Highlight a newly created standard when it appears in the grid
  useEffect(() => {
    if (!pendingScrollToStandardId) return;
    const found = sortedAndFilteredStandards.some(
      (entry) => entry.standard.id === pendingScrollToStandardId
    );
    if (!found) return; // standard hasn't appeared yet; effect will re-run when it does
    const pageIndex = dashboardPages.findIndex((page) =>
      page.items.some((entry) => entry.standard.id === pendingScrollToStandardId)
    );
    if (pageIndex >= 0) {
      setActivePageIndex(pageIndex);
    }
    setPendingScrollToStandardId(null);
    setHighlightedStandardId(pendingScrollToStandardId);
    setTimeout(() => {
      setHighlightedStandardId(null);
    }, 2000);
  }, [dashboardPages, pendingScrollToStandardId, sortedAndFilteredStandards, setPendingScrollToStandardId]);

  const handlePagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / Math.max(windowWidth, 1)
      );
      setActivePageIndex(
        Math.max(0, Math.min(nextIndex, Math.max(dashboardPages.length - 1, 0)))
      );
    },
    [dashboardPages.length, windowWidth]
  );

  const content = useMemo(() => {
    const combinedLoading = loading || layoutLoading;

    if (combinedLoading && dashboardStandards.length === 0) {
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

    if (dashboardStandards.length === 0) {
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

    return (
      <View style={styles.pagerContainer}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePagerScrollEnd}
          style={styles.horizontalPager}
          scrollEventThrottle={16}
        >
          {dashboardPages.map((page) => (
            <View key={page.id} style={[styles.page, { width: windowWidth }]}>
              <DraggableStandardsGrid
                items={page.items}
                onReorder={(orderedIds) => handleReorder(page.id, orderedIds)}
                refreshing={loading}
                onRefresh={refreshProgress}
                renderCard={renderCard}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }, [
    dashboardStandards,
    dashboardPages,
    loading,
    layoutLoading,
    onLaunchBuilder,
    refreshProgress,
    renderCard,
    handleReorder,
    handlePagerScrollEnd,
    theme,
    windowWidth,
  ]);

  const showPageControls = dashboardStandards.length > 0;
  const visiblePageDotIndexes = useMemo(
    () => getVisiblePageDotIndexes(dashboardPages.length, activePageIndex),
    [activePageIndex, dashboardPages.length]
  );

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.screen, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerTopRow}>
          {backButtonLabel ? (
            <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.headerLeftButton}>
              <Text style={[styles.backButton, { color: theme.primary.main }]}>{backButtonLabel}</Text>
            </TouchableOpacity>
          ) : showPageControls ? (
            <View style={styles.headerPageControls}>
              <Text style={[styles.pageTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {currentPage?.name ?? 'Page 1'}
              </Text>
              <View style={styles.pageDots} accessibilityRole="tablist">
                {visiblePageDotIndexes.map((index) => {
                  const page = dashboardPages[index];
                  return (
                    <TouchableOpacity
                      key={page.id}
                      onPress={() => setActivePageIndex(index)}
                      style={[
                        styles.pageDot,
                        {
                          backgroundColor:
                            index === activePageIndex
                              ? theme.primary.main
                              : theme.border.primary,
                        },
                      ]}
                      accessibilityRole="tab"
                      accessibilityLabel={page.name}
                    />
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.headerLeftButton} />
          )}
          <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {showPageControls && onOrganizeStandards ? (
            <TouchableOpacity
              onPress={onOrganizeStandards}
              style={styles.headerMenuButton}
              accessibilityRole="button"
              accessibilityLabel="Manage Standards"
            >
              <MaterialIcons name="edit" size={22} color={theme.text.secondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerMenuButton} />
          )}
        </View>
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
          ...(dashboardPages.length > 1
            ? [
                {
                  key: 'move',
                  label: 'Move to Page',
                  icon: 'swap-horiz',
                  onPress: () => {},
                  subItems: dashboardPages.map((page) => ({
                    key: page.id,
                    label: page.name,
                    onPress: () =>
                      handleMoveStandardToPage(activeMenuStandard.id, page.id),
                  })),
                  selectedSubItemKey: standardPages.find((page) =>
                    page.standards.some((standard) => standard.id === activeMenuStandard.id)
                  )?.id,
                },
              ]
            : []),
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
        message="This standard will be moved to inactive. You can reactivate it later from the Standards Library."
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

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    left: 108,
    position: 'absolute',
    right: 108,
    textAlign: 'center',
  },
  headerLeftButton: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerMenuButton: {
    width: 64,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
    opacity: 0.5,
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
  pagerContainer: {
    flex: 1,
  },
  headerPageControls: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    maxWidth: '100%',
    textAlign: 'left',
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 18,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  horizontalPager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
