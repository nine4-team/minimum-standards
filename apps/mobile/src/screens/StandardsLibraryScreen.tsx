import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Standard } from '@minimum-standards/shared-model';
import { useStandardsLibrary } from '../hooks/useStandardsLibrary';
import { ErrorBanner } from '../components/ErrorBanner';
import { useTheme } from '../theme/useTheme';
import { typography, BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { useStandards } from '../hooks/useStandards';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { StandardCard } from '../components/StandardCard';
import { CARD_LIST_GAP, SCREEN_PADDING, getScreenContainerStyle } from '@nine4/ui-kit';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';

export interface StandardsLibraryScreenProps {
  onBack?: () => void; // Optional - not shown on main screen
  onSelectStandard?: (standard: Standard) => void; // For builder context
  onNavigateToBuilder?: () => void; // Navigate to Standards Builder
  onEditStandard?: (standardId: string) => void; // Navigate to Standards Builder for editing
}

export function StandardsLibraryScreen({
  onBack,
  onSelectStandard,
  onNavigateToBuilder,
  onEditStandard,
}: StandardsLibraryScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeStandards,
    archivedStandards,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    archiveStandard,
    unarchiveStandard,
    deleteStandard,
  } = useStandardsLibrary();

  const { createLogEntry, updateLogEntry } = useStandards();

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteStandardId, setDeleteStandardId] = useState<string | null>(null);
  const [deleteStandardName, setDeleteStandardName] = useState('');

  // Combine active and archived standards into a single list
  const allStandards = useMemo(() => {
    return [...activeStandards, ...archivedStandards];
  }, [activeStandards, archivedStandards]);

  const handleArchive = async (standardId: string) => {
    try {
      await archiveStandard(standardId);
    } catch (err) {
      // Error handling - could show toast/alert
      console.error('Failed to archive standard:', err);
    }
  };

  const handleActivate = async (standardId: string) => {
    try {
      await unarchiveStandard(standardId);
    } catch (err) {
      // Error handling - could show toast/alert
      console.error('Failed to activate standard:', err);
    }
  };

  const handleEdit = useCallback((standardId: string) => {
    if (onEditStandard) {
      onEditStandard(standardId);
    }
  }, [onEditStandard]);

  const handleDelete = useCallback((standardId: string, standardName: string) => {
    setDeleteStandardId(standardId);
    setDeleteStandardName(standardName);
    setDeleteConfirmVisible(true);
  }, []);

  const confirmDeleteStandard = useCallback(async () => {
    if (!deleteStandardId) return;
    try {
      await deleteStandard(deleteStandardId);
    } catch (err) {
      Alert.alert('Error', 'Failed to delete standard');
      console.error('Failed to delete standard:', err);
    }
    setDeleteConfirmVisible(false);
    setDeleteStandardId(null);
  }, [deleteStandardId, deleteStandard]);

  const handleSelect = useCallback((standard: Standard) => {
    if (onEditStandard) {
      onEditStandard(standard.id);
      // Note: onBack() is not called here because:
      // - When used as a modal (StandardsLibraryModal), the modal wrapper handles closing
      // - When used as a main screen, we navigate forward and shouldn't go back
    } else if (onSelectStandard) {
      onSelectStandard(standard);
    }
  }, [onEditStandard, onSelectStandard]);

  const handleRetry = useCallback(() => {
    // Refresh standards if needed
  }, []);

  const renderCard = useCallback(
    ({ item }: { item: Standard }) => {
      return (
        <StandardCard
          standard={item}
          onSelect={() => handleSelect(item)}
          onArchive={() => handleArchive(item.id)}
          onActivate={() => handleActivate(item.id)}
          onEdit={() => handleEdit(item.id)}
          onDelete={() => handleDelete(item.id, item.name)}
          onSelectStandard={onSelectStandard}
        />
      );
    },
    [handleSelect, handleArchive, handleActivate, handleEdit, handleDelete, onSelectStandard]
  );

  const content = useMemo(() => {
    if (loading && allStandards.length === 0) {
      return (
        <View style={styles.skeletonContainer} testID="library-skeletons">
          {[0, 1, 2].map((key) => (
            <View key={key} style={[styles.skeletonCard, { backgroundColor: theme.background.card }]}>
              <View style={[styles.skeletonLine, { backgroundColor: theme.background.tertiary }]} />
              <View style={[styles.skeletonLineShort, { backgroundColor: theme.background.tertiary }]} />
            </View>
          ))}
        </View>
      );
    }

    if (allStandards.length === 0) {
      return (
        <View style={styles.emptyContainer} testID="library-empty-state">
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {searchQuery.trim()
              ? 'No standards match your search'
              : 'No standards'}
          </Text>
          {!searchQuery.trim() && onNavigateToBuilder && (
            <TouchableOpacity
              onPress={onNavigateToBuilder}
              style={[styles.builderButton, { backgroundColor: theme.button.primary.background }]}
              accessibilityRole="button"
            >
              <Text style={[styles.builderButtonText, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.button.primary.text }]}>Create Standard</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <FlatList
        testID="library-list"
        data={allStandards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRetry} />
        }
      />
    );
  }, [
    allStandards,
    loading,
    onNavigateToBuilder,
    renderCard,
    searchQuery,
    theme,
    handleRetry,
  ]);

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.headerBackButton} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Standards Library</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ErrorBanner error={error} onRetry={handleRetry} />

      {/* Search Input */}
      <View style={[styles.searchContainer, { borderBottomColor: theme.border.secondary, backgroundColor: theme.background.chrome }]}>
        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
              },
            ]}
            placeholder="Search standards..."
            placeholderTextColor={theme.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Standards search input"
          />
          {onNavigateToBuilder && (
            <TouchableOpacity
              style={[styles.inlineCreateButton, { backgroundColor: theme.button.primary.background }]}
              onPress={onNavigateToBuilder}
              accessibilityRole="button"
            >
              <Text style={[styles.inlineCreateButtonText, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.button.primary.text }]}>+ Create</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {content}

      <BottomSheetConfirmation
        visible={deleteConfirmVisible}
        onRequestClose={() => {
          setDeleteConfirmVisible(false);
          setDeleteStandardId(null);
        }}
        title="Delete Standard"
        message={`Are you sure you want to delete "${deleteStandardName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteStandard}
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
  },
  headerBackButton: {
    width: 64,
    paddingVertical: 4,
  },
  headerSpacer: {
    width: 64,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  headerButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  searchContainer: {
    padding: SCREEN_PADDING,
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inlineCreateButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  inlineCreateButtonText: {
    // fontSize and fontWeight come from typography.button.primary
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
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
  card: {
    borderRadius: 16,
    padding: 0,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  volumePeriodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionParamsText: {
    fontSize: 13,
  },
  headerActions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  menuButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    borderRadius: 12,
    minWidth: 200,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
