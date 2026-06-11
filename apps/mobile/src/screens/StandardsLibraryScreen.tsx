import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Standard } from '@minimum-standards/shared-model';
import {
  BUTTON_BORDER_RADIUS,
  CARD_LIST_GAP,
  SCREEN_PADDING,
  typography,
} from '@nine4/ui-kit';
import { BottomSheetConfirmation } from '../components/BottomSheetConfirmation';
import { BottomSheetMenu, type BottomSheetMenuItem } from '../components/BottomSheetMenu';
import { ErrorBanner } from '../components/ErrorBanner';
import { StandardCard } from '../components/StandardCard';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useStandards } from '../hooks/useStandards';
import { useStandardsLibrary } from '../hooks/useStandardsLibrary';
import { useTheme } from '../theme/useTheme';
import {
  DASHBOARD_PAGE_SIZE,
  addDashboardDraftPage,
  areDashboardPagesEquivalent,
  buildDashboardPages,
  buildPlacementUpdates,
  moveStandardInDashboardPages,
  moveStandardToPage,
  renameDashboardDraftPage,
  reorderDashboardDraftPage,
  type DashboardPage,
} from '../utils/dashboardPages';

export interface StandardsLibraryScreenProps {
  onBack?: () => void;
  onSelectStandard?: (standard: Standard) => void;
  onNavigateToBuilder?: () => void;
  onEditStandard?: (standardId: string) => void;
}

type RowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragTarget =
  | { kind: 'standard'; pageId: string; standardId: string; index: number; frame: RowFrame }
  | { kind: 'empty-page'; pageId: string; index: 0; frame: RowFrame };

type MoveSheetState =
  | { kind: 'activate'; standard: Standard }
  | { kind: 'move'; standard: Standard }
  | null;

type PageMenuState = DashboardPage<Standard> | null;
type StandardMenuState = Standard | null;

const UNTITLED_STANDARD_LABEL = 'Untitled Standard';

export function StandardsLibraryScreen(props: StandardsLibraryScreenProps) {
  if (props.onSelectStandard && !props.onEditStandard) {
    return <StandardsLibraryPickerScreen {...props} />;
  }
  return <ManageStandardsScreen {...props} />;
}

function ManageStandardsScreen({
  onBack,
  onNavigateToBuilder,
  onEditStandard,
}: StandardsLibraryScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    standards,
    activeStandards,
    archivedStandards,
    loading: standardsLoading,
    error: standardsError,
    archiveStandard,
    unarchiveStandard,
    deleteStandard,
  } = useStandards();
  const {
    layout,
    loading: layoutLoading,
    error: layoutError,
    saveLayoutAndPlacements,
  } = useDashboardLayout();

  const [pages, setPages] = useState<DashboardPage<Standard>[]>([]);
  const [deleteStandardId, setDeleteStandardId] = useState<string | null>(null);
  const [deleteStandardName, setDeleteStandardName] = useState('');
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [pageMenu, setPageMenu] = useState<PageMenuState>(null);
  const [standardMenu, setStandardMenu] = useState<StandardMenuState>(null);
  const [moveSheet, setMoveSheet] = useState<MoveSheetState>(null);
  const [draggingStandardId, setDraggingStandardId] = useState<string | null>(null);

  const pagesRef = useRef<DashboardPage<Standard>[]>([]);
  const pendingExternalSyncRef = useRef(false);
  const scrollOffsetY = useRef(0);
  const pageFrames = useRef<Record<string, RowFrame>>({});
  const targetFrames = useRef<Record<string, DragTarget>>({});
  const startFrame = useRef<RowFrame | null>(null);
  const dragActiveRef = useRef(false);
  const draggingStandardIdRef = useRef<string | null>(null);
  const dragTranslation = useMemo(() => new Animated.ValueXY(), []);

  const sourcePages = useMemo(
    () => buildDashboardPages(activeStandards, layout),
    [activeStandards, layout]
  );

  const applyOptimisticPages = useCallback((nextPages: DashboardPage<Standard>[]) => {
    pendingExternalSyncRef.current = true;
    pagesRef.current = nextPages;
    setPages(nextPages);
  }, []);

  useEffect(() => {
    if (dragActiveRef.current) return;
    if (pendingExternalSyncRef.current) {
      if (!areDashboardPagesEquivalent(sourcePages, pagesRef.current)) return;
      pendingExternalSyncRef.current = false;
    }
    setPages(sourcePages);
    pagesRef.current = sourcePages;
  }, [sourcePages]);

  const persistPages = useCallback(
    async (nextPages: DashboardPage<Standard>[]) => {
      applyOptimisticPages(nextPages);
      const layoutPages = nextPages.map(({ standards: _standards, ...page }, index) => ({
        ...page,
        orderIndex: index,
      }));
      try {
        await saveLayoutAndPlacements(layoutPages, buildPlacementUpdates(nextPages));
      } catch (err) {
        pendingExternalSyncRef.current = false;
        throw err;
      }
    },
    [applyOptimisticPages, saveLayoutAndPlacements]
  );

  const handleRetry = useCallback(() => {
    // Live hooks resubscribe automatically. This keeps ErrorBanner API satisfied.
  }, []);

  const handleCreatePage = useCallback(async () => {
    try {
      await persistPages(addDashboardDraftPage(pagesRef.current));
    } catch (err) {
      Alert.alert('Error', 'Failed to add page');
      console.error('Failed to add page:', err);
    }
  }, [persistPages]);

  const handleRenamePage = useCallback(
    (page: DashboardPage<Standard>) => {
      const prompt = (Alert as unknown as {
        prompt?: (
          title: string,
          message?: string,
          callbackOrButtons?: any,
          type?: string,
          defaultValue?: string
        ) => void;
      }).prompt;

      if (!prompt) {
        Alert.alert('Rename Page', 'Page renaming is available on iOS.');
        return;
      }

      prompt(
        'Rename Page',
        undefined,
        async (name: string) => {
          try {
            await persistPages(renameDashboardDraftPage(pagesRef.current, page.id, name));
          } catch (err) {
            Alert.alert('Error', 'Failed to rename page');
            console.error('Failed to rename page:', err);
          }
        },
        'plain-text',
        page.name
      );
    },
    [persistPages]
  );

  const handleMovePage = useCallback(
    async (pageId: string, direction: -1 | 1) => {
      try {
        await persistPages(reorderDashboardDraftPage(pagesRef.current, pageId, direction));
      } catch (err) {
        Alert.alert('Error', 'Failed to move page');
        console.error('Failed to move page:', err);
      }
    },
    [persistPages]
  );

  const handleDeletePage = useCallback(
    async (page: DashboardPage<Standard>) => {
      if (page.standards.length > 0) {
        Alert.alert('Page has standards', 'Move standards to another page or deactivate them before deleting this page.');
        return;
      }
      if (pagesRef.current.length <= 1) {
        Alert.alert('Page required', 'At least one page is required.');
        return;
      }
      try {
        await persistPages(
          pagesRef.current
            .filter((candidate) => candidate.id !== page.id)
            .map((candidate, index) => ({ ...candidate, orderIndex: index }))
        );
      } catch (err) {
        Alert.alert('Error', 'Failed to delete page');
        console.error('Failed to delete page:', err);
      }
    },
    [persistPages]
  );

  const handleDeactivate = useCallback(
    async (standard: Standard) => {
      try {
        const nextPages = pagesRef.current.map((page) => ({
          ...page,
          standards: page.standards.filter((item) => item.id !== standard.id),
        }));
        applyOptimisticPages(nextPages);
        await archiveStandard(standard.id);
        await persistPages(nextPages);
      } catch (err) {
        pendingExternalSyncRef.current = false;
        setPages(sourcePages);
        pagesRef.current = sourcePages;
        Alert.alert('Error', 'Failed to deactivate standard');
        console.error('Failed to deactivate standard:', err);
      }
    },
    [applyOptimisticPages, archiveStandard, persistPages, sourcePages]
  );

  const handleActivateToPage = useCallback(
    async (standard: Standard, pageId: string) => {
      const targetPage = pagesRef.current.find((page) => page.id === pageId);
      if (!targetPage) return;
      if (targetPage.standards.length >= DASHBOARD_PAGE_SIZE) {
        Alert.alert('Page full', 'Choose another page or create a new page.');
        return;
      }

      try {
        const nextPages = pagesRef.current.map((page) =>
          page.id === pageId
            ? { ...page, standards: [...page.standards, standard] }
            : page
        );
        applyOptimisticPages(nextPages);
        await unarchiveStandard(standard.id);
        await persistPages(nextPages);
        setMoveSheet(null);
      } catch (err) {
        pendingExternalSyncRef.current = false;
        setPages(sourcePages);
        pagesRef.current = sourcePages;
        Alert.alert('Error', 'Failed to activate standard');
        console.error('Failed to activate standard:', err);
      }
    },
    [applyOptimisticPages, persistPages, sourcePages, unarchiveStandard]
  );

  const handleCreatePageForActivation = useCallback(
    async (standard?: Standard) => {
      const nextPages = addDashboardDraftPage(pagesRef.current);
      try {
        await persistPages(nextPages);
        if (standard) {
          await handleActivateToPage(standard, nextPages[nextPages.length - 1].id);
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to create page');
        console.error('Failed to create page:', err);
      }
    },
    [handleActivateToPage, persistPages]
  );

  const handleMoveStandardToPage = useCallback(
    async (standard: Standard, pageId: string) => {
      const result = moveStandardToPage(pagesRef.current, standard.id, pageId);
      if (result.error) {
        Alert.alert('Unable to move standard', result.error);
        return;
      }
      try {
        await persistPages(result.pages);
        setMoveSheet(null);
      } catch (err) {
        Alert.alert('Error', 'Failed to move standard');
        console.error('Failed to move standard:', err);
      }
    },
    [persistPages]
  );

  const handleDeleteStandard = useCallback((standard: Standard) => {
    setDeleteStandardId(standard.id);
    setDeleteStandardName(standard.name || UNTITLED_STANDARD_LABEL);
  }, []);

  const confirmDeleteStandard = useCallback(async () => {
    if (!deleteStandardId) return;
    try {
      await deleteStandard(deleteStandardId);
      const nextPages = pagesRef.current.map((page) => ({
        ...page,
        standards: page.standards.filter((standard) => standard.id !== deleteStandardId),
      }));
      setPages(nextPages);
      pagesRef.current = nextPages;
    } catch (err) {
      Alert.alert('Error', 'Failed to delete standard');
      console.error('Failed to delete standard:', err);
    } finally {
      setDeleteStandardId(null);
      setDeleteStandardName('');
    }
  }, [deleteStandard, deleteStandardId]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const getNearestTarget = useCallback((standardId: string, ghostCenterY: number): DragTarget | null => {
    let nearest: DragTarget | null = null;
    let nearestDistance = Infinity;
    Object.values(targetFrames.current).forEach((target) => {
      if (target.kind === 'standard' && target.standardId === standardId) return;
      const centerY = target.frame.y - scrollOffsetY.current + target.frame.height / 2;
      const distance = Math.abs(centerY - ghostCenterY);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    });
    return nearest;
  }, []);

  const handleGestureEvent = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { translationX: dragTranslation.x, translationY: dragTranslation.y } }],
        {
          useNativeDriver: false,
          listener: (event: any) => {
            const standardId = draggingStandardIdRef.current;
            if (!dragActiveRef.current || !standardId || !startFrame.current) return;

            const ghostCenterY =
              startFrame.current.y -
              scrollOffsetY.current +
              startFrame.current.height / 2 +
              event.nativeEvent.translationY;
            const target = getNearestTarget(standardId, ghostCenterY);
            if (!target) return;

            const result = moveStandardInDashboardPages(
              pagesRef.current,
              standardId,
              target.pageId,
              target.index
            );
            if (!result.error) {
              pagesRef.current = result.pages;
              setPages(result.pages);
            }
          },
        }
      ),
    [dragTranslation, getNearestTarget]
  );

  const handleGestureStateChange = useCallback(
    async (event: any) => {
      const { state, x, y } = event.nativeEvent;

      if (state === State.ACTIVE) {
        const scrollOff = scrollOffsetY.current;
        const touched = Object.values(targetFrames.current).find((target) => {
          if (target.kind !== 'standard') return false;
          const top = target.frame.y - scrollOff;
          const bottom = top + target.frame.height;
          return x >= target.frame.x && x <= target.frame.x + target.frame.width && y >= top && y <= bottom;
        });
        if (!touched || touched.kind !== 'standard') return;

        dragActiveRef.current = true;
        draggingStandardIdRef.current = touched.standardId;
        startFrame.current = { ...touched.frame };
        dragTranslation.setValue({ x: 0, y: 0 });
        setDraggingStandardId(touched.standardId);
        return;
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (!dragActiveRef.current) return;
        dragActiveRef.current = false;
        draggingStandardIdRef.current = null;
        startFrame.current = null;
        dragTranslation.setValue({ x: 0, y: 0 });
        setDraggingStandardId(null);
        try {
          await persistPages(pagesRef.current);
        } catch (err) {
          Alert.alert('Error', 'Failed to save standard order');
          console.error('Failed to save standard order:', err);
        }
      }
    },
    [dragTranslation, persistPages]
  );

  const draggingStandard = useMemo(() => {
    if (!draggingStandardId) return null;
    return pages
      .flatMap((page) => page.standards)
      .find((standard) => standard.id === draggingStandardId) ?? null;
  }, [draggingStandardId, pages]);

  const createMenuItems = useMemo<BottomSheetMenuItem[]>(
    () => [
      {
        key: 'standard',
        label: 'New Standard',
        icon: 'add-circle-outline',
        onPress: () => onNavigateToBuilder?.(),
      },
      {
        key: 'page',
        label: 'New Page',
        icon: 'view-carousel',
        onPress: handleCreatePage,
      },
    ],
    [handleCreatePage, onNavigateToBuilder]
  );

  const pageMenuItems = useMemo<BottomSheetMenuItem[]>(() => {
    if (!pageMenu) return [];
    const index = pages.findIndex((page) => page.id === pageMenu.id);
    return [
      {
        key: 'rename',
        label: 'Rename',
        icon: 'edit',
        onPress: () => handleRenamePage(pageMenu),
      },
      {
        key: 'move-up',
        label: 'Move Up',
        icon: 'keyboard-arrow-up',
        disabled: index <= 0,
        onPress: () => handleMovePage(pageMenu.id, -1),
      },
      {
        key: 'move-down',
        label: 'Move Down',
        icon: 'keyboard-arrow-down',
        disabled: index < 0 || index >= pages.length - 1,
        onPress: () => handleMovePage(pageMenu.id, 1),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        destructive: true,
        onPress: () => handleDeletePage(pageMenu),
      },
    ];
  }, [handleDeletePage, handleMovePage, handleRenamePage, pageMenu, pages]);

  const standardMenuItems = useMemo<BottomSheetMenuItem[]>(() => {
    if (!standardMenu) return [];
    const isActive = standardMenu.state === 'active';
    return [
      {
        key: 'edit',
        label: 'Edit',
        icon: 'edit',
        onPress: () => onEditStandard?.(standardMenu.id),
      },
      ...(isActive
        ? [
            {
              key: 'move',
              label: 'Move to Page',
              icon: 'drive-file-move',
              onPress: () => setMoveSheet({ kind: 'move', standard: standardMenu }),
            },
          ]
        : [
            {
              key: 'activate',
              label: 'Activate',
              icon: 'toggle-on',
              onPress: () => setMoveSheet({ kind: 'activate', standard: standardMenu }),
            },
          ]),
      {
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        destructive: true,
        onPress: () => handleDeleteStandard(standardMenu),
      },
    ];
  }, [handleDeleteStandard, onEditStandard, standardMenu]);

  const pagePickerItems = useMemo<BottomSheetMenuItem[]>(() => {
    if (!moveSheet) return [];
    const currentPage = pages.find((page) =>
      page.standards.some((standard) => standard.id === moveSheet.standard.id)
    );
    return [
      ...pages.map((page) => {
        const full = page.standards.length >= DASHBOARD_PAGE_SIZE;
        const selected = currentPage?.id === page.id;
        return {
          key: page.id,
          label: `${page.name} · ${page.standards.length}/${DASHBOARD_PAGE_SIZE}${selected ? ' · Current' : ''}`,
          icon: selected ? 'check' : 'view-carousel',
          disabled: full || selected,
          onPress: () =>
            moveSheet.kind === 'activate'
              ? handleActivateToPage(moveSheet.standard, page.id)
              : handleMoveStandardToPage(moveSheet.standard, page.id),
        };
      }),
      {
        key: 'new-page',
        label: 'Create New Page',
        icon: 'add',
        onPress: () =>
          moveSheet.kind === 'activate'
            ? handleCreatePageForActivation(moveSheet.standard)
            : handleCreatePageForActivation().then(() => {
                const nextPage = pagesRef.current[pagesRef.current.length - 1];
                if (nextPage) {
                  void handleMoveStandardToPage(moveSheet.standard, nextPage.id);
                }
              }),
      },
    ];
  }, [
    handleActivateToPage,
    handleCreatePageForActivation,
    handleMoveStandardToPage,
    moveSheet,
    pages,
  ]);

  const combinedLoading = standardsLoading || layoutLoading;
  const combinedError = standardsError ?? layoutError;

  return (
    <GestureHandlerRootView style={[styles.screen, { backgroundColor: theme.background.screen }]}>
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
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Manage Standards</Text>
        <TouchableOpacity
          onPress={() => setCreateMenuVisible(true)}
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="Create"
        >
          <MaterialIcons name="add" size={24} color={theme.text.primary} />
        </TouchableOpacity>
      </View>

      <ErrorBanner error={combinedError} onRetry={handleRetry} />

      <PanGestureHandler
        activateAfterLongPress={350}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureStateChange}
      >
        <Animated.View style={styles.body}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(180, insets.bottom + 150) },
            ]}
            scrollEnabled={draggingStandardId === null}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {combinedLoading && standards.length === 0 ? (
              <View style={styles.skeletonContainer} testID="library-skeletons">
                {[0, 1, 2].map((key) => (
                  <View key={key} style={[styles.skeletonCard, { backgroundColor: theme.background.card }]}>
                    <View style={[styles.skeletonLine, { backgroundColor: theme.background.tertiary }]} />
                    <View style={[styles.skeletonLineShort, { backgroundColor: theme.background.tertiary }]} />
                  </View>
                ))}
              </View>
            ) : standards.length === 0 ? (
              <View style={styles.emptyContainer} testID="library-empty-state">
                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No standards</Text>
                <TouchableOpacity
                  onPress={() => setCreateMenuVisible(true)}
                  style={[styles.primaryButton, { backgroundColor: theme.button.primary.background }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.primaryButtonText, { color: theme.button.primary.text }]}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Active Standards</Text>
                {pages.map((page) => (
                  <View
                    key={page.id}
                    style={styles.pageSection}
                    onLayout={(event) => {
                      pageFrames.current[page.id] = event.nativeEvent.layout;
                    }}
                  >
                    <View style={[styles.pageHeader, { borderBottomColor: theme.border.secondary }]}>
                      <View style={styles.pageTitleBlock}>
                        <Text style={[styles.pageTitle, { color: theme.text.primary }]} numberOfLines={1}>
                          {page.name}
                        </Text>
                        <Text style={[styles.pageCount, { color: theme.text.secondary }]}>
                          {page.standards.length}/{DASHBOARD_PAGE_SIZE}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setPageMenu(page)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Page actions for ${page.name}`}
                      >
                        <MaterialIcons name="more-horiz" size={22} color={theme.text.secondary} />
                      </TouchableOpacity>
                    </View>

                    {page.standards.length === 0 ? (
                      <View
                        style={[styles.emptyPageRow, { borderBottomColor: theme.border.secondary }]}
                        onLayout={(event) => {
                          const pageFrame = pageFrames.current[page.id] ?? { x: 0, y: 0, width: 0, height: 0 };
                          const rowFrame = event.nativeEvent.layout;
                          targetFrames.current[`empty-${page.id}`] = {
                            kind: 'empty-page',
                            pageId: page.id,
                            index: 0,
                            frame: {
                              ...rowFrame,
                              x: pageFrame.x + rowFrame.x,
                              y: pageFrame.y + rowFrame.y,
                            },
                          };
                        }}
                      >
                        <Text style={[styles.emptyPageText, { color: theme.text.secondary }]}>Empty</Text>
                      </View>
                    ) : (
                      page.standards.map((standard, standardIndex) => {
                        const isDragging = draggingStandardId === standard.id;
                        return (
                          <ManageStandardRow
                            key={standard.id}
                            standard={standard}
                            active
                            isDragging={isDragging}
                            onToggle={() => handleDeactivate(standard)}
                            onMenu={() => setStandardMenu(standard)}
                            onLayout={(rowFrame) => {
                              const pageFrame = pageFrames.current[page.id] ?? { x: 0, y: 0, width: 0, height: 0 };
                              targetFrames.current[standard.id] = {
                                kind: 'standard',
                                pageId: page.id,
                                standardId: standard.id,
                                index: standardIndex,
                                frame: {
                                  ...rowFrame,
                                  x: pageFrame.x + rowFrame.x,
                                  y: pageFrame.y + rowFrame.y,
                                },
                              };
                            }}
                          />
                        );
                      })
                    )}
                  </View>
                ))}

                <Text style={[styles.sectionTitle, styles.inactiveTitle, { color: theme.text.secondary }]}>
                  Inactive Standards
                </Text>
                {archivedStandards.length === 0 ? (
                  <Text style={[styles.emptyInactiveText, { color: theme.text.secondary }]}>
                    No inactive standards
                  </Text>
                ) : (
                  archivedStandards.map((standard) => (
                    <ManageStandardRow
                      key={standard.id}
                      standard={standard}
                      active={false}
                      onToggle={() => setMoveSheet({ kind: 'activate', standard })}
                      onMenu={() => setStandardMenu(standard)}
                    />
                  ))
                )}
              </>
            )}
          </ScrollView>

          {draggingStandard && startFrame.current && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.dragGhost,
                {
                  top: startFrame.current.y - scrollOffsetY.current,
                  left: startFrame.current.x,
                  width: startFrame.current.width,
                  height: startFrame.current.height,
                  backgroundColor: theme.background.card,
                  borderColor: theme.primary.main,
                  transform: dragTranslation.getTranslateTransform(),
                },
              ]}
            >
              <Text style={[styles.standardName, { color: theme.text.primary }]} numberOfLines={1}>
                {draggingStandard.name}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </PanGestureHandler>

      <BottomSheetMenu
        visible={createMenuVisible}
        onRequestClose={() => setCreateMenuVisible(false)}
        title="Create"
        items={createMenuItems}
      />
      <BottomSheetMenu
        visible={pageMenu !== null}
        onRequestClose={() => setPageMenu(null)}
        title={pageMenu?.name}
        items={pageMenuItems}
      />
      <BottomSheetMenu
        visible={standardMenu !== null}
        onRequestClose={() => setStandardMenu(null)}
        title={standardMenu?.name}
        items={standardMenuItems}
      />
      <BottomSheetMenu
        visible={moveSheet !== null}
        onRequestClose={() => setMoveSheet(null)}
        title={moveSheet?.kind === 'activate' ? 'Choose Dashboard Page' : 'Move to Page'}
        items={pagePickerItems}
      />
      <BottomSheetConfirmation
        visible={deleteStandardId !== null}
        onRequestClose={() => {
          setDeleteStandardId(null);
          setDeleteStandardName('');
        }}
        title="Delete Standard"
        message={`Are you sure you want to delete "${deleteStandardName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteStandard}
      />
    </GestureHandlerRootView>
  );
}

function ManageStandardRow({
  standard,
  active,
  isDragging = false,
  onToggle,
  onMenu,
  onLayout,
}: {
  standard: Standard;
  active: boolean;
  isDragging?: boolean;
  onToggle: () => void;
  onMenu: () => void;
  onLayout?: (frame: RowFrame) => void;
}) {
  const theme = useTheme();
  const standardName = standard.name || UNTITLED_STANDARD_LABEL;

  return (
    <View
      style={[
        styles.standardRow,
        styles.cardBase,
        { borderColor: theme.border.secondary },
        {
          backgroundColor: theme.background.card,
          opacity: isDragging ? 0.35 : active ? 1 : 0.62,
        },
      ]}
      onLayout={(event) => onLayout?.(event.nativeEvent.layout)}
    >
      <View style={styles.standardText}>
        <Text style={[styles.standardName, { color: theme.text.primary }]} numberOfLines={1}>
          {standardName}
        </Text>
        <Text style={[styles.standardSummary, { color: theme.text.secondary }]} numberOfLines={2}>
          {standard.summary}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.toggleContainer}
        accessibilityRole="switch"
        accessibilityState={{ checked: active }}
        accessibilityLabel={active ? `Deactivate ${standardName}` : `Activate ${standardName}`}
      >
        <View style={[styles.toggle, { backgroundColor: active ? theme.button.primary.background : theme.input.border }]}>
          <View
            style={[
              styles.toggleThumb,
              {
                backgroundColor: theme.background.primary,
                transform: [{ translateX: active ? 20 : 0 }],
              },
            ]}
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onMenu}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${standardName}`}
      >
        <MaterialIcons name="more-horiz" size={22} color={theme.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

function StandardsLibraryPickerScreen({
  onBack,
  onSelectStandard,
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
  } = useStandardsLibrary();

  const allStandards = useMemo(
    () => [...activeStandards, ...archivedStandards],
    [activeStandards, archivedStandards]
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background.screen }]}>
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
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Standards Library</Text>
        <View style={styles.headerSide} />
      </View>
      <ErrorBanner error={error} onRetry={() => {}} />
      <View style={[styles.searchContainer, { borderBottomColor: theme.border.secondary }]}>
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
          accessibilityLabel="Standards search input"
        />
      </View>
      <ScrollView contentContainerStyle={styles.pickerContent}>
        {loading && allStandards.length === 0 ? (
          <View style={styles.skeletonContainer} testID="library-skeletons">
            {[0, 1, 2].map((key) => (
              <View key={key} style={[styles.skeletonCard, { backgroundColor: theme.background.card }]}>
                <View style={[styles.skeletonLine, { backgroundColor: theme.background.tertiary }]} />
                <View style={[styles.skeletonLineShort, { backgroundColor: theme.background.tertiary }]} />
              </View>
            ))}
          </View>
        ) : allStandards.length === 0 ? (
          <View style={styles.emptyContainer} testID="library-empty-state">
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No standards</Text>
          </View>
        ) : (
          allStandards.map((standard) => (
            <StandardCard
              key={standard.id}
              standard={standard}
              onSelect={() => onSelectStandard?.(standard)}
              onSelectStandard={onSelectStandard}
              showActions={false}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 64,
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SCREEN_PADDING,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  inactiveTitle: {
    marginTop: 16,
  },
  pageSection: {
    gap: 4,
    marginBottom: 4,
  },
  pageHeader: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageTitleBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  pageCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPageRow: {
    minHeight: 22,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyPageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyInactiveText: {
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
  },
  standardRow: {
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardBase: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  standardText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  standardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  standardSummary: {
    fontSize: 13,
    fontWeight: '500',
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
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  primaryButtonText: {
    fontSize: typography.button.primary.fontSize,
    fontWeight: typography.button.primary.fontWeight,
  },
  skeletonContainer: {
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
  searchContainer: {
    padding: SCREEN_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContent: {
    padding: SCREEN_PADDING,
    gap: CARD_LIST_GAP,
  },
  dragGhost: {
    position: 'absolute',
    zIndex: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
});
