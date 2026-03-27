import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SETTINGS_STACK_ROOT_SCREEN_NAME, type SettingsStackParamList } from '../navigation/types';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useCategories } from '../hooks/useCategories';
import { useStandards } from '../hooks/useStandards';
import { useTheme } from '../theme/useTheme';
import { UNCATEGORIZED_CATEGORY_ID } from '@minimum-standards/shared-model';
import { getScreenContainerStyle } from '@nine4/ui-kit';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';
import { BottomSheetMenu } from '../components/BottomSheetMenu';

export function CategorySettingsScreen() {
  const MAX_CATEGORY_NAME_LENGTH = 120;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'Categories'>>();
  const {
    orderedCategories,
    loading: categoriesLoading,
    error: categoriesError,
    createCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
  } = useCategories();
  const { standards, loading: standardsLoading, updateStandard } = useStandards();
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [addStandardsModalVisible, setAddStandardsModalVisible] = useState(false);
  const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState<string | null>(null);
  const [selectedStandardsForBulk, setSelectedStandardsForBulk] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteCategoryName, setDeleteCategoryName] = useState('');
  const [deleteCategoryCount, setDeleteCategoryCount] = useState(0);

  const [assignMenuVisible, setAssignMenuVisible] = useState(false);
  const [assignStandardId, setAssignStandardId] = useState<string | null>(null);
  const [assignStandardName, setAssignStandardName] = useState('');
  const [assignExcludeCategoryId, setAssignExcludeCategoryId] = useState<string | null>(null);

  // Calculate counts per category based on standards
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    standards.forEach((standard) => {
      if (standard.archivedAtMs !== null) return; // skip archived
      const categoryId = standard.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });
    return counts;
  }, [standards]);

  // Active standards (non-archived)
  const activeStandards = useMemo(() => {
    return standards.filter((s) => s.archivedAtMs === null && s.state === 'active');
  }, [standards]);

  // Only show uncategorized standards in the add picker.
  const availableStandardsForCategory = useMemo(() => {
    if (!selectedCategoryForAdd) return [];
    return activeStandards.filter(
      (standard) => standard.categoryId == null || standard.categoryId === ''
    );
  }, [activeStandards, selectedCategoryForAdd]);

  const toggleCategoryExpanded = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (route.params?.backTo === 'Dashboard') {
      // We were launched from Active Standards via a tab jump into Settings → Categories.
      // "goBack" would only pop within the Settings stack, so we:
      // 1) reset Settings back to its root so the Settings tab is still usable
      // 2) switch tabs back to Dashboard.
      navigation.reset({
        index: 0,
        routes: [{ name: SETTINGS_STACK_ROOT_SCREEN_NAME }],
      });
      navigation.getParent()?.navigate('Dashboard' as never);
      return;
    }
    navigation.goBack();
  }, [navigation, route.params?.backTo]);

  const handleCreateCategory = useCallback(async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Category name cannot be empty.');
      return;
    }
    if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
      Alert.alert('Error', `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`);
      return;
    }

    try {
      setCreatingCategory(true);
      await createCategory({ name: trimmedName });
      setNewCategoryName('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  }, [newCategoryName, createCategory]);

  const handleStartRename = useCallback((categoryId: string, currentName: string) => {
    setEditingCategoryId(categoryId);
    setEditingName(currentName);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingCategoryId(null);
    setEditingName('');
  }, []);

  const handleSaveRename = useCallback(async () => {
    const trimmedName = editingName.trim();
    if (!editingCategoryId || !trimmedName) {
      return;
    }
    if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
      Alert.alert('Error', `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`);
      return;
    }

    try {
      await renameCategory(editingCategoryId, { name: trimmedName });
      setEditingCategoryId(null);
      setEditingName('');
      Alert.alert('Success', 'Category renamed successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to rename category');
    }
  }, [editingCategoryId, editingName, renameCategory]);

  const handleDeleteCategory = useCallback(
    async (categoryId: string, categoryName: string) => {
      const count = categoryCounts.get(categoryId) ?? 0;
      setDeleteCategoryId(categoryId);
      setDeleteCategoryName(categoryName);
      setDeleteCategoryCount(count);
      setDeleteConfirmVisible(true);
    },
    [categoryCounts]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCategoryId) return;
    const count = deleteCategoryCount;
    try {
      if (count > 0) {
        const affectedStandards = standards.filter(
          (s) => (s.categoryId ?? UNCATEGORIZED_CATEGORY_ID) === deleteCategoryId
        );
        await Promise.all(
          affectedStandards.map((s) =>
            updateStandard({
              standardId: s.id,
              name: s.name,
              notes: s.notes ?? null,
              categoryId: null,
              minimum: s.minimum,
              unit: s.unit,
              cadence: s.cadence,
              sessionConfig: s.sessionConfig,
              periodStartPreference: s.periodStartPreference ?? undefined,
            })
          )
        );
      }
      await deleteCategory(deleteCategoryId);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete category');
    }
    setDeleteConfirmVisible(false);
    setDeleteCategoryId(null);
  }, [deleteCategoryId, deleteCategoryCount, standards, deleteCategory, updateStandard]);

  const handleMoveUp = useCallback(
    async (categoryId: string) => {
      const currentIndex = orderedCategories.findIndex((c) => c.id === categoryId);
      if (currentIndex <= 0) return;

      const newOrder = [...orderedCategories];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
        newOrder[currentIndex],
        newOrder[currentIndex - 1],
      ];

      await reorderCategories(newOrder.map((c) => c.id));
    },
    [orderedCategories, reorderCategories]
  );

  const handleMoveDown = useCallback(
    async (categoryId: string) => {
      const currentIndex = orderedCategories.findIndex((c) => c.id === categoryId);
      if (currentIndex < 0 || currentIndex >= orderedCategories.length - 1) return;

      const newOrder = [...orderedCategories];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
        newOrder[currentIndex + 1],
        newOrder[currentIndex],
      ];

      await reorderCategories(newOrder.map((c) => c.id));
    },
    [orderedCategories, reorderCategories]
  );

  const handleMoveStandardToCategory = useCallback(
    async (stdId: string, targetCategoryId: string) => {
      const s = standards.find((x) => x.id === stdId);
      if (!s) return;
      try {
        await updateStandard({
          standardId: s.id,
          name: s.name,
          notes: s.notes ?? null,
          categoryId: targetCategoryId === UNCATEGORIZED_CATEGORY_ID ? null : targetCategoryId,
          minimum: s.minimum,
          unit: s.unit,
          cadence: s.cadence,
          sessionConfig: s.sessionConfig,
          periodStartPreference: s.periodStartPreference ?? undefined,
        });
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to move standard');
      }
    },
    [standards, updateStandard]
  );

  const handleOpenAddStandardsModal = useCallback((categoryId: string) => {
    setSelectedCategoryForAdd(categoryId);
    setSelectedStandardsForBulk(new Set());
    setBulkMode(false);
    setAddStandardsModalVisible(true);
  }, []);

  const handleCloseAddStandardsModal = useCallback(() => {
    setAddStandardsModalVisible(false);
    setSelectedCategoryForAdd(null);
    setSelectedStandardsForBulk(new Set());
    setBulkMode(false);
  }, []);

  const handleToggleStandardSelection = useCallback((standardId: string) => {
    setSelectedStandardsForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  }, []);

  const handleAddStandardToCategory = useCallback(
    async (stdId: string) => {
      if (!selectedCategoryForAdd) return;
      const s = standards.find((x) => x.id === stdId);
      if (!s) return;

      try {
        await updateStandard({
          standardId: s.id,
          name: s.name,
          notes: s.notes ?? null,
          categoryId: selectedCategoryForAdd === UNCATEGORIZED_CATEGORY_ID ? null : selectedCategoryForAdd,
          minimum: s.minimum,
          unit: s.unit,
          cadence: s.cadence,
          sessionConfig: s.sessionConfig,
          periodStartPreference: s.periodStartPreference ?? undefined,
        });
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add standard to category');
      }
    },
    [selectedCategoryForAdd, standards, updateStandard]
  );

  const handleBulkAddStandardsToCategory = useCallback(
    async () => {
      if (!selectedCategoryForAdd || selectedStandardsForBulk.size === 0) return;

      const categoryId = selectedCategoryForAdd === UNCATEGORIZED_CATEGORY_ID ? null : selectedCategoryForAdd;
      const standardsToUpdate = standards.filter((s) => selectedStandardsForBulk.has(s.id));

      try {
        await Promise.all(
          standardsToUpdate.map((s) =>
            updateStandard({
              standardId: s.id,
              name: s.name,
              notes: s.notes ?? null,
              categoryId,
              minimum: s.minimum,
              unit: s.unit,
              cadence: s.cadence,
              sessionConfig: s.sessionConfig,
              periodStartPreference: s.periodStartPreference ?? undefined,
            })
          )
        );
        handleCloseAddStandardsModal();
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add standards to category');
      }
    },
    [selectedCategoryForAdd, selectedStandardsForBulk, standards, updateStandard, handleCloseAddStandardsModal]
  );

  if (categoriesLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.screen }]}>
        <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity onPress={handleBack} accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Categories</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.button.primary.background} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Categories</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Create New Category */}
        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Create Category</Text>
          <View style={styles.createRow}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.input.background,
                  borderColor: theme.input.border,
                  color: theme.input.text,
                },
              ]}
              placeholder="Category name"
              placeholderTextColor={theme.input.placeholder}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              onSubmitEditing={handleCreateCategory}
            />
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.button.primary.background }]}
              onPress={handleCreateCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
            >
              {creatingCategory ? (
                <ActivityIndicator size="small" color={theme.button.primary.text} />
              ) : (
                <Text style={[styles.createButtonText, { color: theme.button.primary.text }]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories List */}
        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Categories</Text>
          {orderedCategories.map((category, index) => {
            const count = categoryCounts.get(category.id) ?? 0;
            const isEditing = editingCategoryId === category.id;
            const isSystem = category.isSystem ?? false;

            return (
              <View
                key={category.id}
                style={[
                  styles.categoryRow,
                  {
                    borderBottomColor: theme.border.secondary,
                    borderBottomWidth: index !== orderedCategories.length - 1 ? 1 : 0,
                  },
                ]}
              >
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          backgroundColor: theme.input.background,
                          borderColor: theme.input.border,
                          color: theme.input.text,
                        },
                      ]}
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveRename}
                      disabled={!editingName.trim()}
                    >
                      <MaterialIcons name="check" size={20} color={theme.button.primary.background} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRename}>
                      <MaterialIcons name="close" size={20} color={theme.text.secondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.categoryHeader}>
                      <TouchableOpacity
                        style={[styles.expandButton, { borderColor: theme.border.secondary }]}
                        onPress={() => toggleCategoryExpanded(category.id)}
                        accessibilityRole="button"
                      >
                        <MaterialIcons
                          name={expandedCategories.has(category.id) ? 'expand-less' : 'expand-more'}
                          size={22}
                          color={theme.text.secondary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.categoryInfo}
                        onPress={() => toggleCategoryExpanded(category.id)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.categoryName, { color: theme.text.primary }]}>{category.name}</Text>
                        <Text style={[styles.categoryCount, { color: theme.text.secondary }]}>
                          {count} standard{count === 1 ? '' : 's'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.categoryActions}>
                        <TouchableOpacity
                          style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                          onPress={() => handleMoveUp(category.id)}
                          disabled={index === 0}
                        >
                          <MaterialIcons
                            name="keyboard-arrow-up"
                            size={24}
                            color={index === 0 ? theme.text.tertiary : theme.text.secondary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.moveButton,
                            index === orderedCategories.length - 1 && styles.moveButtonDisabled,
                          ]}
                          onPress={() => handleMoveDown(category.id)}
                          disabled={index === orderedCategories.length - 1}
                        >
                          <MaterialIcons
                            name="keyboard-arrow-down"
                            size={24}
                            color={index === orderedCategories.length - 1 ? theme.text.tertiary : theme.text.secondary}
                          />
                        </TouchableOpacity>
                        {!isSystem && (
                          <>
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => handleStartRename(category.id, category.name)}
                            >
                              <MaterialIcons name="edit" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => handleDeleteCategory(category.id, category.name)}
                            >
                              <MaterialIcons name="delete" size={20} color={theme.text.secondary} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                    {expandedCategories.has(category.id) && (
                      <View style={styles.activitiesList}>
                        {(() => {
                          const categoryStandards = standards
                            .filter(s => {
                              if (s.archivedAtMs !== null) return false;
                              const stdCategoryId = s.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
                              return stdCategoryId === category.id;
                            })
                            .sort((a, b) => a.name.localeCompare(b.name));

                          return (
                            <>
                              {categoryStandards.length === 0 ? (
                                <Text style={[styles.emptyText, { color: theme.text.tertiary }]}>
                                  No standards in this category
                                </Text>
                              ) : (
                                categoryStandards.map((std) => (
                                  <View
                                    key={std.id}
                                    style={[
                                      styles.activityRow,
                                      { borderBottomColor: theme.border.secondary },
                                    ]}
                                  >
                                    <View style={styles.activityInfo}>
                                      <Text style={[styles.activityName, { color: theme.text.primary }]}>
                                        {std.name}
                                      </Text>
                                      <Text style={[styles.activityUnit, { color: theme.text.secondary }]}>
                                        {std.unit}
                                      </Text>
                                    </View>
                                    <View style={styles.activityActions}>
                                      <TouchableOpacity
                                        style={styles.activityActionButton}
                                        onPress={() => {
                                          setAssignStandardId(std.id);
                                          setAssignStandardName(std.name);
                                          setAssignExcludeCategoryId(category.id);
                                          setAssignMenuVisible(true);
                                        }}
                                      >
                                        <MaterialIcons name="drive-file-move" size={20} color={theme.text.secondary} />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ))
                              )}
                              <TouchableOpacity
                                style={[styles.addActivityButton, { borderColor: theme.border.secondary }]}
                                onPress={() => handleOpenAddStandardsModal(category.id)}
                              >
                                <MaterialIcons name="add" size={20} color={theme.button.primary.background} />
                                <Text style={[styles.addActivityButtonText, { color: theme.button.primary.background }]}>
                                  Add Standards
                                </Text>
                              </TouchableOpacity>
                            </>
                          );
                        })()}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>

        {categoriesError && (
          <View style={[styles.errorContainer, { backgroundColor: theme.background.card }]}>
            <Text style={[styles.errorText, { color: theme.input.borderError }]}>
              {categoriesError.message}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Standards Modal */}
      <Modal
        visible={addStandardsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseAddStandardsModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background.screen }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.background.chrome, borderBottomColor: theme.border.secondary, paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity onPress={handleCloseAddStandardsModal} style={styles.modalHeaderButton}>
              <MaterialIcons name="close" size={24} color={theme.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
              {bulkMode
                ? `Bulk Add Standards${selectedCategoryForAdd ? ` to ${orderedCategories.find((c) => c.id === selectedCategoryForAdd)?.name ?? 'Category'}` : ''}`
                : `Add Standards${selectedCategoryForAdd ? ` to ${orderedCategories.find((c) => c.id === selectedCategoryForAdd)?.name ?? 'Category'}` : ''}`}
            </Text>
            {availableStandardsForCategory.length > 0 ? (
              <TouchableOpacity
                style={styles.modalHeaderButton}
                onPress={() => {
                  if (bulkMode) {
                    handleBulkAddStandardsToCategory();
                  } else {
                    setBulkMode(true);
                  }
                }}
                disabled={bulkMode && selectedStandardsForBulk.size === 0}
              >
                {bulkMode ? (
                  <Text
                    style={[
                      styles.modalActionText,
                      {
                        color:
                          selectedStandardsForBulk.size === 0
                            ? theme.text.tertiary
                            : theme.button.primary.background,
                      },
                    ]}
                  >
                    Add ({selectedStandardsForBulk.size})
                  </Text>
                ) : (
                  <Text style={[styles.modalActionText, { color: theme.button.primary.background }]}>
                    Bulk
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.modalHeaderButton} />
            )}
          </View>

          <Text style={[styles.modalNoticeText, { color: theme.text.secondary }]}>
            Only uncategorized active standards are shown here.
          </Text>

          {availableStandardsForCategory.length === 0 ? (
            <View style={styles.modalEmptyContainer}>
              <Text style={[styles.modalEmptyText, { color: theme.text.secondary }]}>
                No standards available to add
              </Text>
            </View>
          ) : (
            <FlatList
              data={availableStandardsForCategory}
              keyExtractor={(item) => item.id}
              renderItem={({ item: std }) => {
                const isSelected = selectedStandardsForBulk.has(std.id);

                if (bulkMode) {
                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalActivityRow,
                        { backgroundColor: theme.background.surface, borderBottomColor: theme.border.secondary },
                        isSelected && { backgroundColor: theme.button.primary.background + '20' },
                      ]}
                      onPress={() => handleToggleStandardSelection(std.id)}
                    >
                      <View style={styles.modalActivityInfo}>
                        <Text style={[styles.modalActivityName, { color: theme.text.primary }]}>
                          {std.name}
                        </Text>
                        <Text style={[styles.modalActivityUnit, { color: theme.text.secondary }]}>
                          {std.unit}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check-circle" size={24} color={theme.button.primary.background} />
                      )}
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalActivityRow,
                        { backgroundColor: theme.background.surface, borderBottomColor: theme.border.secondary },
                      ]}
                      onPress={() => handleAddStandardToCategory(std.id)}
                    >
                      <View style={styles.modalActivityInfo}>
                        <Text style={[styles.modalActivityName, { color: theme.text.primary }]}>
                          {std.name}
                        </Text>
                        <Text style={[styles.modalActivityUnit, { color: theme.text.secondary }]}>
                          {std.unit}
                        </Text>
                      </View>
                      <MaterialIcons name="add" size={24} color={theme.button.primary.background} />
                    </TouchableOpacity>
                  );
                }
              }}
              contentContainerStyle={styles.modalContentContainer}
            />
          )}
        </View>
      </Modal>

      <BottomSheetConfirmation
        visible={deleteConfirmVisible}
        onRequestClose={() => {
          setDeleteConfirmVisible(false);
          setDeleteCategoryId(null);
        }}
        title="Delete Category"
        message={
          deleteCategoryCount > 0
            ? `"${deleteCategoryName}" has ${deleteCategoryCount} standard${deleteCategoryCount === 1 ? '' : 's'}. Move them to Uncategorized?`
            : `Are you sure you want to delete "${deleteCategoryName}"?`
        }
        confirmLabel={deleteCategoryCount > 0 ? 'Move to Uncategorized' : 'Delete'}
        destructive
        onConfirm={handleConfirmDelete}
      />

      <BottomSheetMenu
        visible={assignMenuVisible}
        onRequestClose={() => {
          setAssignMenuVisible(false);
          setAssignStandardId(null);
        }}
        title={assignStandardName ? `Assign "${assignStandardName}"` : 'Assign Category'}
        items={[
          ...orderedCategories
            .filter((c) => c.id !== UNCATEGORIZED_CATEGORY_ID && c.id !== assignExcludeCategoryId)
            .map((c) => ({
              key: c.id,
              label: c.name,
              onPress: () => {
                if (assignStandardId) {
                  handleMoveStandardToCategory(assignStandardId, c.id);
                }
              },
            })),
          {
            key: UNCATEGORIZED_CATEGORY_ID,
            label: 'Uncategorized',
            onPress: () => {
              if (assignStandardId) {
                handleMoveStandardToCategory(assignStandardId, UNCATEGORIZED_CATEGORY_ID);
              }
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryRow: {
    borderBottomWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activitiesList: {
    paddingLeft: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityUnit: {
    fontSize: 13,
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityActionButton: {
    padding: 4,
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addActivityButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderButton: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalNoticeText: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    textAlign: 'center',
  },
  modalContentContainer: {
    padding: 16,
  },
  modalActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalActivityInfo: {
    flex: 1,
  },
  modalActivityName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  modalActivityUnit: {
    fontSize: 14,
  },
  modalEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalEmptyText: {
    fontSize: 16,
  },
  moveButton: {
    padding: 4,
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  actionButton: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  saveButton: {
    padding: 4,
  },
  cancelButton: {
    padding: 4,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
  },
});
