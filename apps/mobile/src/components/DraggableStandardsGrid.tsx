import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import type { DashboardStandard } from '../hooks/useActiveStandardsDashboard';
import { CARD_LIST_GAP, SCREEN_PADDING } from '@nine4/ui-kit';

interface CellFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DraggableStandardsGridProps {
  items: DashboardStandard[];
  onReorder: (orderedIds: string[]) => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Called for each card slot. isDragging=true means this card is being dragged (show dimmed). */
  renderCard: (item: DashboardStandard, isDragging: boolean) => React.ReactNode;
}

export function DraggableStandardsGrid({
  items,
  onReorder,
  refreshing,
  onRefresh,
  renderCard,
}: DraggableStandardsGridProps) {
  const [orderedItems, setOrderedItems] = useState<DashboardStandard[]>([...items]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const dragTranslation = useMemo(() => new Animated.ValueXY(), []);
  const draggingIndexRef = useRef<number | null>(null);
  const orderedItemsRef = useRef<DashboardStandard[]>([...items]);
  // Frames measured in scroll-content coordinates (from onLayout on each cell)
  const cellFrames = useRef<(CellFrame | null)[]>([]);
  // The cell frame at drag start, stored in scroll-content coordinates
  const startCellFrameContent = useRef<CellFrame | null>(null);
  const dragActiveRef = useRef(false);
  // Current scroll offset (to convert content coords → Animated.View coords)
  const scrollOffsetY = useRef(0);

  // Sync items from parent. During a drag the grid owns order.
  useEffect(() => {
    if (dragActiveRef.current) return;

    const currentIds = orderedItemsRef.current.map(i => i.standard.id);
    const incomingIds = items.map(i => i.standard.id);
    const sameSet =
      currentIds.length === incomingIds.length &&
      currentIds.every(id => incomingIds.includes(id));

    if (!sameSet) {
      // Items added or removed — full reset
      const copy = [...items];
      orderedItemsRef.current = copy;
      setOrderedItems(copy);
      return;
    }

    // Same items — refresh data (progress) in grid's current order
    const itemMap = new Map(items.map(i => [i.standard.id, i]));
    let changed = false;
    const updated = orderedItemsRef.current.map(old => {
      const incoming = itemMap.get(old.standard.id);
      if (!incoming || incoming === old) return old;
      if (incoming.progress !== old.progress) changed = true;
      return incoming;
    });
    if (changed) {
      orderedItemsRef.current = updated;
      setOrderedItems(updated);
    }
  }, [items]);

  const handleGestureEvent = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { translationX: dragTranslation.x, translationY: dragTranslation.y } }],
        {
          useNativeDriver: false,
          listener: (event: any) => {
            if (!dragActiveRef.current || draggingIndexRef.current === null) return;
            const { translationX, translationY } = event.nativeEvent;
            const startFrame = startCellFrameContent.current!;
            const scrollOff = scrollOffsetY.current;

            // Ghost center in Animated.View coordinates
            const ghostCenterX = startFrame.x + startFrame.width / 2 + translationX;
            const ghostCenterY =
              startFrame.y - scrollOff + startFrame.height / 2 + translationY;

            let nearestIndex = draggingIndexRef.current;
            let nearestDist = Infinity;
            const n = orderedItemsRef.current.length;

            for (let i = 0; i < n; i++) {
              const frame = cellFrames.current[i];
              if (!frame) continue;
              const cx = frame.x + frame.width / 2;
              const cy = frame.y - scrollOff + frame.height / 2;
              const dist = Math.abs(cx - ghostCenterX) + Math.abs(cy - ghostCenterY);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
              }
            }

            if (nearestIndex !== draggingIndexRef.current) {
              const fromIndex = draggingIndexRef.current;
              draggingIndexRef.current = nearestIndex;
              setDraggingIndex(nearestIndex);
              setOrderedItems((prev) => {
                const next = [...prev];
                const [removed] = next.splice(fromIndex, 1);
                next.splice(nearestIndex, 0, removed);
                orderedItemsRef.current = next;
                return next;
              });
            }
          },
        }
      ),
    [dragTranslation]
  );

  const handleStateChange = useCallback(
    (event: any) => {
      const { state, x, y } = event.nativeEvent;

      if (state === State.ACTIVE) {
        // Long press fired — find which cell was touched.
        // x,y are in Animated.View coordinates; cell frames are in content coordinates.
        const scrollOff = scrollOffsetY.current;
        const touchedIndex = cellFrames.current.findIndex((frame) => {
          if (!frame) return false;
          const cellTopInView = frame.y - scrollOff;
          const cellBottomInView = cellTopInView + frame.height;
          return (
            x >= frame.x &&
            x <= frame.x + frame.width &&
            y >= cellTopInView &&
            y <= cellBottomInView
          );
        });

        if (touchedIndex === -1) return;

        draggingIndexRef.current = touchedIndex;
        startCellFrameContent.current = { ...cellFrames.current[touchedIndex]! };
        dragActiveRef.current = true;
        dragTranslation.setValue({ x: 0, y: 0 });
        setDraggingIndex(touchedIndex);
      } else if (
        state === State.END ||
        state === State.CANCELLED ||
        state === State.FAILED
      ) {
        if (dragActiveRef.current) {
          const finalItems = orderedItemsRef.current;
          const finalIds = finalItems.map((d) => d.standard.id);
          draggingIndexRef.current = null;
          setDraggingIndex(null);
          dragTranslation.setValue({ x: 0, y: 0 });
          dragActiveRef.current = false;
          onReorder(finalIds);
        }
      }
    },
    [dragTranslation, onReorder]
  );

  const ghostItem = draggingIndex !== null ? orderedItems[draggingIndex] : null;
  const ghostFrameContent = startCellFrameContent.current;

  return (
    <GestureHandlerRootView style={styles.container}>
      <PanGestureHandler
        activateAfterLongPress={400}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
      >
        <Animated.View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          scrollEnabled={draggingIndex === null}
          onScroll={(e) => {
            scrollOffsetY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.grid}>
            {orderedItems.map((item, index) => (
              <View
                key={item.standard.id}
                style={styles.cell}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  cellFrames.current[index] = { x, y, width, height };
                }}
              >
                {renderCard(item, draggingIndex === index)}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Ghost card — positioned in Animated.View space, outside ScrollView */}
        {ghostItem !== null && ghostFrameContent !== null && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                // Convert content coordinates to Animated.View coordinates
                top: ghostFrameContent.y - scrollOffsetY.current,
                left: ghostFrameContent.x,
                width: ghostFrameContent.width,
                height: ghostFrameContent.height,
                transform: dragTranslation.getTranslateTransform(),
              },
            ]}
          >
            {renderCard(ghostItem, false)}
          </Animated.View>
        )}
        </Animated.View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    padding: SCREEN_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: CARD_LIST_GAP,
  },
  cell: {
    width: '50%',
  },
  ghost: {
    position: 'absolute',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
