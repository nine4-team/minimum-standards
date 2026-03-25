import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { SETTINGS_TAB_ROUTE_NAME } from '../navigation/types';
import type { Standard } from '@minimum-standards/shared-model';
import { UNCATEGORIZED_CATEGORY_ID } from '@minimum-standards/shared-model';
import { useActiveStandardsDashboard } from '../hooks/useActiveStandardsDashboard';
import type { DashboardStandard } from '../hooks/useActiveStandardsDashboard';
import { useActivities } from '../hooks/useActivities';
import { useCategories } from '../hooks/useCategories';
import { useStandards } from '../hooks/useStandards';
import type { Activity } from '@minimum-standards/shared-model';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { trackStandardEvent } from '../utils/analytics';
import { LogEntryModal } from '../components/LogEntryModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { StandardProgressCard } from '../components/StandardProgressCard';
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
  const filterTabsScrollRef = useRef<ScrollView>(null);
  const filterTabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  
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

  const { activities, updateActivity } = useActivities();
  const { orderedCategories } = useCategories();
  const { archivedStandards, unarchiveStandard, deleteStandard, deleteLogEntry } = useStandards();

  // State for inactive standard action menu
  const [inactiveMenuStandard, setInactiveMenuStandard] = useState<Standard | null>(null);
  const [inactiveMenuVisible, setInactiveMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [categorizeMenuEntry, setCategorizeMenuEntry] = useState<DashboardStandard | null>(null);
  const [categorizeMenuVisible, setCategorizeMenuVisible] = useState(false);

  // State for active standard action bottom sheet (T037–T041)
  const [activeMenuStandard, setActiveMenuStandard] = useState<Standard | null>(null);
  const [activeMenuVisible, setActiveMenuVisible] = useState(false);
  const [activeDeactivateConfirmVisible, setActiveDeactivateConfirmVisible] = useState(false);
  const [activeDeleteConfirmVisible, setActiveDeleteConfirmVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  // Create activity lookup map for category resolution
  const activityMap = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((activity) => {
      map.set(activity.id, activity);
    });
    return map;
  }, [activities]);
  const { focusedCategoryId, setFocusedCategoryId, showTimeBar, setShowTimeBar, hiddenTimeBarStandardIds, toggleTimeBarForStandard, showInactiveStandards, setShowInactiveStandards, pendingScrollToStandardId, setPendingScrollToStandardId } = useUIPreferencesStore();
  const flatListRef = useRef<FlatList<DashboardStandard>>(null);
  const [highlightedStandardId, setHighlightedStandardId] = useState<string | null>(null);

  // Create activity lookup map for efficient name resolution
  const activityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach((activity) => {
      map.set(activity.id, activity.name);
    });
    return map;
  }, [activities]);

  const customCategories = useMemo(() => {
    return orderedCategories.filter(
      (c) => !c.isSystem && c.id !== UNCATEGORIZED_CATEGORY_ID
    );
  }, [orderedCategories]);

  const hasCustomCategories = customCategories.length > 0;
  const cardCategorizeLabel = hasCustomCategories ? 'Category' : 'Create categories';

  const hasInitializedCategoryFilter = useRef(false);

  // Ensure a valid focus filter and default to the first custom category on launch.
  useEffect(() => {
    if (!hasCustomCategories) {
      if (focusedCategoryId !== null) {
        setFocusedCategoryId(null);
      }
      hasInitializedCategoryFilter.current = false;
      return;
    }

    if (!hasInitializedCategoryFilter.current) {
      setFocusedCategoryId(null);
      hasInitializedCategoryFilter.current = true;
      return;
    }

    if (focusedCategoryId === null) {
      return;
    }

    const allowed = new Set<string>([
      ...customCategories.map((c) => c.id),
      UNCATEGORIZED_CATEGORY_ID,
    ]);
    if (!allowed.has(focusedCategoryId)) {
      setFocusedCategoryId(null);
    }
  }, [customCategories, focusedCategoryId, hasCustomCategories, setFocusedCategoryId]);

  const getEffectiveCategoryId = useCallback(
    (entry: DashboardStandard): string => {
      const activity = activityMap.get(entry.standard.activityId);
      const effectiveCategoryId = activity?.categoryId ?? entry.standard.categoryId ?? null;
      return effectiveCategoryId ?? UNCATEGORIZED_CATEGORY_ID;
    },
    [activityMap]
  );

  const handleLogPress = useCallback(
    (entry: DashboardStandard) => {
      trackStandardEvent('dashboard_log_tap', {
        standardId: entry.standard.id,
        activityId: entry.standard.activityId,
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

  const activeMenuCategoryId = useMemo(() => {
    if (!activeMenuStandard) return null;
    const activity = activityMap.get(activeMenuStandard.activityId);
    return activity?.categoryId ?? null;
  }, [activeMenuStandard, activityMap]);

  const handleActiveAssignCategory = useCallback(async (categoryId: string | null) => {
    if (!activeMenuStandard) return;
    try {
      await updateActivity(activeMenuStandard.activityId, { categoryId });
    } catch (err) {
      Alert.alert('Error', 'Failed to assign category');
      console.error('Failed to assign category:', err);
    }
    setCategoryPickerVisible(false);
    setActiveMenuStandard(null);
  }, [activeMenuStandard, updateActivity]);

  const categoryPickerItems = useMemo(() => {
    if (!activeMenuStandard) return [];
    return [
      {
        key: 'none',
        label: 'None',
        icon: activeMenuCategoryId === null ? 'check' : undefined,
        onPress: () => handleActiveAssignCategory(null),
      },
      ...customCategories.map((cat) => ({
        key: cat.id,
        label: cat.name,
        icon: activeMenuCategoryId === cat.id ? 'check' : undefined,
        onPress: () => handleActiveAssignCategory(cat.id),
      })),
    ];
  }, [activeMenuStandard, activeMenuCategoryId, customCategories, handleActiveAssignCategory]);

  const handleViewInactiveLogs = useCallback((standardId: string) => {
    navigation.navigate('StandardPeriodActivityLogs', {
      standardId,
    });
  }, [navigation]);

  // Calculate counts for chips
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    dashboardStandards.forEach((entry) => {
      const categoryId = getEffectiveCategoryId(entry);
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });
    return { counts, total: dashboardStandards.length };
  }, [dashboardStandards, getEffectiveCategoryId]);

  const handleFilterTabPress = useCallback(
    (categoryId: string | null) => {
      setFocusedCategoryId(categoryId);
    },
    [setFocusedCategoryId]
  );

  const filterTabs = useMemo(() => {
    const tabs: Array<{
      key: string;
      categoryId: string | null;
      label: string;
      accessibilityLabel: string;
    }> = [];

    tabs.push({
      key: '__all__',
      categoryId: null,
      label: `All (${categoryCounts.total})`,
      accessibilityLabel: `All standards, ${categoryCounts.total} total`,
    });

    customCategories.forEach((category) => {
      const count = categoryCounts.counts.get(category.id) ?? 0;
      tabs.push({
        key: category.id,
        categoryId: category.id,
        label: `${category.name} (${count})`,
        accessibilityLabel: `${category.name} category, ${count} standards`,
      });
    });

    const uncategorizedCount = categoryCounts.counts.get(UNCATEGORIZED_CATEGORY_ID) ?? 0;
    tabs.push({
      key: UNCATEGORIZED_CATEGORY_ID,
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      label: `Uncategorized (${uncategorizedCount})`,
      accessibilityLabel: `Uncategorized, ${uncategorizedCount} standards`,
    });

    return tabs;
  }, [categoryCounts.counts, categoryCounts.total, customCategories]);

  const selectedFilterTabKey = focusedCategoryId ?? '__all__';

  // Keep the selected tab in view (same behavior as chart tabs).
  useEffect(() => {
    const layout = filterTabLayouts.current[selectedFilterTabKey];
    if (layout && filterTabsScrollRef.current) {
      filterTabsScrollRef.current.scrollTo({
        x: layout.x - 16,
        animated: true,
      });
    }
  }, [selectedFilterTabKey]);

  const handleCategorizePress = useCallback(() => {
    navigation.navigate(
      SETTINGS_TAB_ROUTE_NAME as any,
      { screen: 'Categories', params: { backTo: 'Dashboard' } } as any
    );
  }, [navigation]);

  const handleCardCategorize = useCallback(
    (entry: DashboardStandard) => {
      if (!hasCustomCategories) {
        trackStandardEvent('dashboard_categorize_missing_categories', {
          standardId: entry.standard.id,
          activityId: entry.standard.activityId,
        });
        handleCategorizePress();
        return;
      }

      setCategorizeMenuEntry(entry);
      setCategorizeMenuVisible(true);
    },
    [hasCustomCategories, handleCategorizePress]
  );

  const handleAssignCategory = useCallback(
    async (entry: DashboardStandard, categoryId: string) => {
      const activityName = activityNameMap.get(entry.standard.activityId) ?? entry.standard.activityId;
      try {
        trackStandardEvent('dashboard_categorize_assign', {
          standardId: entry.standard.id,
          activityId: entry.standard.activityId,
          categoryId,
        });
        await updateActivity(entry.standard.activityId, {
          categoryId: categoryId === UNCATEGORIZED_CATEGORY_ID ? null : categoryId,
        });
      } catch (err) {
        Alert.alert('Error', `Failed to assign "${activityName}" to a category`);
        console.error('Failed to assign category:', err);
      }
    },
    [activityNameMap, updateActivity]
  );

  const renderCard = useCallback(
    ({ item }: { item: DashboardStandard }) => {
      const standardId = item.standard.id;
      const isOverriddenForStandard = hiddenTimeBarStandardIds.includes(standardId);
      const effectiveShowTimeBar = isOverriddenForStandard ? !showTimeBar : showTimeBar;
      return (
        <StandardCard
          entry={item}
          onLogPress={() => handleLogPress(item)}
          onCardPress={() => handleLogPress(item)}
          onMenuPress={() => handleActiveMenuOpen(item.standard)}
          activityNameMap={activityNameMap}
          nowMs={nowMs}
          showTimeBar={effectiveShowTimeBar}
          onToggleTimeBar={() => toggleTimeBarForStandard(standardId)}
          highlighted={item.standard.id === highlightedStandardId}
        />
      );
    },
    [
      handleActiveMenuOpen,
      handleLogPress,
      activityNameMap,
      nowMs,
      showTimeBar,
      hiddenTimeBarStandardIds,
      toggleTimeBarForStandard,
      highlightedStandardId,
    ]
  );

  const sortedAndFilteredStandards = useMemo(() => {
    const sortStandards = (a: DashboardStandard, b: DashboardStandard) => {
      if (sortOption === 'completion') {
        const aProgress = a.progress?.progressPercent ?? 0;
        const bProgress = b.progress?.progressPercent ?? 0;
        return aProgress - bProgress;
      }
      const aName = activityNameMap.get(a.standard.activityId) ?? a.standard.activityId;
      const bName = activityNameMap.get(b.standard.activityId) ?? b.standard.activityId;
      return aName.localeCompare(bName);
    };

    const base = dashboardStandards;
    const filtered =
      focusedCategoryId === null
        ? base
        : base.filter((entry) => getEffectiveCategoryId(entry) === focusedCategoryId);
    return [...filtered].sort(sortStandards);
  }, [activityNameMap, dashboardStandards, focusedCategoryId, getEffectiveCategoryId, sortOption]);

  // Scroll to a newly created standard's card when it appears in the list
  useEffect(() => {
    if (!pendingScrollToStandardId) return;
    // Clear category filter so the new card is visible regardless of category
    if (focusedCategoryId !== null) {
      setFocusedCategoryId(null);
    }
    const index = sortedAndFilteredStandards.findIndex(
      (entry) => entry.standard.id === pendingScrollToStandardId
    );
    if (index === -1) return; // standard hasn't appeared in data yet; effect will re-run when it does
    setPendingScrollToStandardId(null);
    setHighlightedStandardId(pendingScrollToStandardId);
    // Allow FlatList to render the item before scrolling
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 300);
    // Clear highlight after a brief flash
    setTimeout(() => {
      setHighlightedStandardId(null);
    }, 2000);
  }, [pendingScrollToStandardId, sortedAndFilteredStandards, focusedCategoryId, setFocusedCategoryId, setPendingScrollToStandardId]);

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

    return (
      <FlatList
        ref={flatListRef}
        testID="dashboard-list"
        data={sortedAndFilteredStandards}
        renderItem={renderCard}
        keyExtractor={(item) => item.standard.id}
        contentContainerStyle={styles.listContent}
        onScrollToIndexFailed={() => {}}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshProgress} />
        }
        ListEmptyComponent={
          <View style={styles.emptyFilteredContainer} testID="dashboard-empty-filter">
            <Text style={[styles.emptyFilteredText, { color: theme.text.secondary }]}>
              No standards in this category
            </Text>
            <TouchableOpacity
              onPress={() => setFocusedCategoryId(null)}
              style={[styles.clearFilterButton, { borderColor: theme.border.secondary }]}
              accessibilityRole="button"
              accessibilityLabel="Show all standards"
            >
              <Text style={[styles.clearFilterButtonText, { color: theme.text.secondary }]}>
                Show All
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          showInactiveStandards && archivedStandards.length > 0 ? (
            <View style={styles.inactiveSection}>
              <Text style={[styles.inactiveSectionHeader, { color: theme.text.secondary }]}>
                Inactive Standards
              </Text>
              {archivedStandards.map((standard) => {
                const activityName = activityNameMap.get(standard.activityId) ?? standard.activityId;
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
    activityNameMap,
    archivedStandards,
    dashboardStandards,
    handleInactiveMenuOpen,
    loading,
    onLaunchBuilder,
    refreshProgress,
    renderCard,
    setFocusedCategoryId,
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
        ) : (
          <TouchableOpacity
            onPress={() => setShowTimeBar(!showTimeBar)}
            style={styles.headerLeftButton}
            accessibilityRole="button"
            accessibilityLabel={showTimeBar ? 'Hide all time bars' : 'Show all time bars'}
          >
            <MaterialIcons name="hourglass-empty" size={24} color={showTimeBar ? theme.button.icon.icon : theme.text.tertiary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Standards</Text>
        <TouchableOpacity
          onPress={() => setHeaderMenuVisible(true)}
          style={styles.headerMenuButton}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.button.icon.icon} />
        </TouchableOpacity>
      </View>

      {/* Focus Tabs Row */}
      {dashboardStandards.length > 0 && hasCustomCategories && (
        <View
          style={[
            styles.filterTabsContainer,
            {
              backgroundColor: theme.background.chrome,
              borderBottomColor: theme.border.secondary,
            },
          ]}
        >
          <ScrollView
            ref={filterTabsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScrollContent}
          >
            {filterTabs.map((tab) => {
              const isSelected = (tab.categoryId ?? '__all__') === selectedFilterTabKey;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onLayout={(event) => {
                    filterTabLayouts.current[tab.key] = event.nativeEvent.layout;
                    // If this is the selected tab, snap to it immediately (no animation)
                    if (tab.key === selectedFilterTabKey) {
                      filterTabsScrollRef.current?.scrollTo({
                        x: event.nativeEvent.layout.x - 16,
                        animated: false,
                      });
                    }
                  }}
                  style={[
                    styles.filterTab,
                    isSelected && {
                      borderBottomColor: theme.tabBar.activeTint,
                      borderBottomWidth: 3,
                    },
                  ]}
                  onPress={() => handleFilterTabPress(tab.categoryId)}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={tab.accessibilityLabel}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: isSelected ? theme.tabBar.activeTint : theme.text.secondary },
                      isSelected && { fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ErrorBanner error={error} onRetry={handleRetry} />

      {content}

      <LogEntryModal
        visible={logModalVisible}
        standard={selectedStandard}
        onClose={handleLogModalClose}
        onSave={handleLogSave}
        resolveActivityName={(activityId) => activityNameMap.get(activityId)}
        resolveActivity={(activityId) => activities.find((a) => a.id === activityId)}
        onDeleteLogEntry={async (logEntryId, standardId, occurredAtMs) => {
          await deleteLogEntry({ logEntryId, standardId, occurredAtMs });
        }}
      />

      <BottomSheetMenu
        visible={inactiveMenuVisible}
        onRequestClose={() => setInactiveMenuVisible(false)}
        title={inactiveMenuStandard ? (activityNameMap.get(inactiveMenuStandard.activityId) ?? inactiveMenuStandard.activityId) : ''}
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
            key: 'manage-categories',
            label: 'Manage Categories',
            onPress: handleCategorizePress,
          },
          {
            key: 'show-inactive',
            label: 'Show Inactive Standards',
            icon: showInactiveStandards ? 'check' : undefined,
            onPress: () => setShowInactiveStandards(!showInactiveStandards),
          },
        ]}
      />

      <BottomSheetMenu
        visible={categorizeMenuVisible}
        onRequestClose={() => {
          setCategorizeMenuVisible(false);
          setCategorizeMenuEntry(null);
        }}
        title="Category"
        items={categorizeMenuEntry ? [
          ...customCategories.map((category) => ({
            key: category.id,
            label: category.name,
            icon: getEffectiveCategoryId(categorizeMenuEntry) === category.id ? 'check' : undefined,
            onPress: async () => {
              try {
                trackStandardEvent('dashboard_categorize_assign', {
                  standardId: categorizeMenuEntry.standard.id,
                  activityId: categorizeMenuEntry.standard.activityId,
                  categoryId: category.id,
                });
                await updateActivity(categorizeMenuEntry.standard.activityId, { categoryId: category.id });
              } catch (err) {
                Alert.alert('Error', 'Failed to assign category');
                console.error('Failed to assign category:', err);
              }
            },
          })),
          {
            key: UNCATEGORIZED_CATEGORY_ID,
            label: 'Uncategorized',
            icon: getEffectiveCategoryId(categorizeMenuEntry) === UNCATEGORIZED_CATEGORY_ID ? 'check' : undefined,
            onPress: async () => {
              try {
                trackStandardEvent('dashboard_categorize_assign', {
                  standardId: categorizeMenuEntry.standard.id,
                  activityId: categorizeMenuEntry.standard.activityId,
                  categoryId: UNCATEGORIZED_CATEGORY_ID,
                });
                await updateActivity(categorizeMenuEntry.standard.activityId, { categoryId: null });
              } catch (err) {
                Alert.alert('Error', 'Failed to assign category');
                console.error('Failed to assign category:', err);
              }
            },
          },
        ] : []}
      />

      {/* Active standard action bottom sheet (T037) */}
      <BottomSheetMenu
        visible={activeMenuVisible}
        onRequestClose={() => setActiveMenuVisible(false)}
        title={activeMenuStandard ? (activityNameMap.get(activeMenuStandard.activityId) ?? activeMenuStandard.activityId) : ''}
        items={activeMenuStandard ? [
          {
            key: 'edit',
            label: 'Edit',
            icon: 'edit',
            onPress: handleActiveEdit,
          },
          {
            key: 'categorize',
            label: 'Category',
            icon: 'format-list-bulleted',
            onPress: () => setCategoryPickerVisible(true),
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

      {/* Active standard category picker (T041) */}
      <BottomSheetMenu
        visible={categoryPickerVisible}
        onRequestClose={() => {
          setCategoryPickerVisible(false);
          setActiveMenuStandard(null);
        }}
        title="Category"
        items={categoryPickerItems}
      />
    </View>
  );
}

function StandardCard({
  entry,
  onLogPress,
  onCardPress,
  onMenuPress,
  activityNameMap,
  nowMs,
  showTimeBar,
  onToggleTimeBar,
  highlighted,
}: {
  entry: DashboardStandard;
  onLogPress: () => void;
  onCardPress?: () => void;
  onMenuPress?: () => void;
  activityNameMap: Map<string, string>;
  nowMs: number;
  showTimeBar?: boolean;
  onToggleTimeBar?: () => void;
  highlighted?: boolean;
}) {
  const { standard, progress } = entry;
  
  // Get activity name from map, fallback to activityId if not found
  const activityName = activityNameMap.get(standard.activityId) ?? standard.activityId;
  
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
  emptyFilteredContainer: {
    paddingTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyFilteredText: {
    fontSize: 14,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  filterTabsScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PADDING,
    paddingRight: 16,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
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
