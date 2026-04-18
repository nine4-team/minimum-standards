import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
} from '../hooks/useStandards';
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
    deleteStandard,
    deleteLogEntry,
    updateStandard,
    saveStandardOrder,
  } = useStandards();

  // State for active standard action bottom sheet (T037–T041)
  const [activeMenuStandard, setActiveMenuStandard] = useState<Standard | null>(null);
  const [activeMenuVisible, setActiveMenuVisible] = useState(false);
  const [activeDeactivateConfirmVisible, setActiveDeactivateConfirmVisible] = useState(false);
  const [activeDeleteConfirmVisible, setActiveDeleteConfirmVisible] = useState(false);

  const { pendingScrollToStandardId, setPendingScrollToStandardId } = useUIPreferencesStore();
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
        />
      );
    },
    [handleActiveMenuOpen, handleLogPress, nowMs, highlightedStandardId]
  );

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      try {
        await saveStandardOrder(orderedIds);
      } catch (err) {
        Alert.alert('Error', 'Failed to save order');
        console.error('Failed to save order:', err);
      }
    },
    [saveStandardOrder]
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

  // Highlight a newly created standard when it appears in the grid
  useEffect(() => {
    if (!pendingScrollToStandardId) return;
    const found = sortedAndFilteredStandards.some(
      (entry) => entry.standard.id === pendingScrollToStandardId
    );
    if (!found) return; // standard hasn't appeared yet; effect will re-run when it does
    setPendingScrollToStandardId(null);
    setHighlightedStandardId(pendingScrollToStandardId);
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
      <DraggableStandardsGrid
        items={sortedAndFilteredStandards}
        onReorder={handleReorder}
        refreshing={loading}
        onRefresh={refreshProgress}
        renderCard={renderCard}
      />
    );
  }, [
    dashboardStandards,
    loading,
    onLaunchBuilder,
    refreshProgress,
    renderCard,
    handleReorder,
    theme,
    sortedAndFilteredStandards,
  ]);

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.screen, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        {backButtonLabel ? (
          <TouchableOpacity onPress={onBack} accessibilityRole="button">
            <Text style={[styles.backButton, { color: theme.primary.main }]}>{backButtonLabel}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerLeftButton} />
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
          <MaterialIcons name="more-horiz" size={24} color={theme.text.secondary} />
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
        visible={headerMenuVisible}
        onRequestClose={() => setHeaderMenuVisible(false)}
        title="Options"
        items={[
          {
            key: 'manage-standards',
            label: 'Manage Standards',
            icon: 'tune',
            onPress: () => {
              navigation.navigate(
                SETTINGS_TAB_ROUTE_NAME as any,
                { screen: 'StandardsLibrary' } as any
              );
            },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
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
});
