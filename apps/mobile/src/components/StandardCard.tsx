import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Standard, formatUnitWithCount } from '@minimum-standards/shared-model';
import { useTheme } from '../theme/useTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getCardBorderStyle, getCardBaseStyle } from '@nine4/ui-kit';

export function StandardCard({
  standard,
  onSelect,
  onArchive,
  onActivate,
  onEdit,
  onDelete,
  activityNameMap,
  onSelectStandard,
  showActions = true,
}: {
  standard: Standard;
  onSelect?: () => void;
  onArchive?: () => void;
  onActivate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  activityNameMap?: Map<string, string>; // deprecated - no longer used
  onSelectStandard?: (standard: Standard) => void;
  showActions?: boolean;
}) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuButtonLayout, setMenuButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const menuButtonRef = useRef<View>(null);
  const isActive = standard.state === 'active' && standard.archivedAtMs === null;

  const activityName = standard.name;

  // Format volume/period: "1800 minutes / week" (derive from standard data)
  const { interval, unit: cadenceUnit } = standard.cadence;
  const cadenceStr = interval === 1 ? cadenceUnit : `${interval} ${cadenceUnit}s`;
  const minimumUnitText = formatUnitWithCount(standard.unit, standard.minimum);
  const volumePeriodText = `${standard.minimum} ${minimumUnitText} / ${cadenceStr}`;

  // Format session params: "5 sessions × 15 minutes" (only show if sessionsPerCadence > 1)
  const sessionConfig = standard.sessionConfig;
  const usesSessions = sessionConfig.sessionsPerCadence > 1;
  let sessionParamsText: string | null = null;
  if (usesSessions) {
    const sessionLabelPlural = `${sessionConfig.sessionLabel}s`;
    const sessionVolumeUnit = formatUnitWithCount(standard.unit, sessionConfig.volumePerSession);
    sessionParamsText = `${sessionConfig.sessionsPerCadence} ${sessionLabelPlural} × ${sessionConfig.volumePerSession} ${sessionVolumeUnit}`;
  }

  const handleToggle = useCallback((e: any) => {
    e.stopPropagation();
    if (isActive) {
      onArchive?.();
    } else {
      onActivate?.();
    }
  }, [isActive, onArchive, onActivate]);

  const handleMenuPress = useCallback((e: any) => {
    e.stopPropagation();
    menuButtonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setMenuButtonLayout({ x, y, width, height });
      setMenuVisible(true);
    });
  }, []);

  const handleEditPress = useCallback(() => {
    setMenuVisible(false);
    onEdit?.();
  }, [onEdit]);

  const handleDeletePress = useCallback(() => {
    setMenuVisible(false);
    onDelete?.();
  }, [onDelete]);

  return (
    <>
      <TouchableOpacity
        style={[
          localStyles.card,
          getCardBaseStyle({ radius: 16 }),
          getCardBorderStyle(theme),
          {
            backgroundColor: theme.background.card,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={onSelect ?? (() => onSelectStandard?.(standard))}
        activeOpacity={onSelect ? 0.7 : 1}
        accessibilityRole={onSelect ? 'button' : undefined}
        accessibilityLabel={onSelect ? `Edit ${activityName} standard` : undefined}
      >
        <View style={[localStyles.cardContent, { opacity: isActive ? 1 : 0.6 }]}>
          <View style={localStyles.cardHeader}>
            <View style={localStyles.titleBlock}>
              <Text style={[localStyles.activityName, { color: theme.text.primary }]} numberOfLines={1}>
                {activityName}
              </Text>
              <Text style={[localStyles.volumePeriodText, { color: theme.text.primary }]} numberOfLines={1}>
                {volumePeriodText}
              </Text>
              {sessionParamsText !== null && (
                <Text style={[localStyles.sessionParamsText, { color: theme.text.secondary }]} numberOfLines={1}>
                  {sessionParamsText}
                </Text>
              )}
            </View>
            <View style={localStyles.headerActions}>
              <View style={localStyles.actionButtonsRow}>
                {showActions && (
                  <>
                    <TouchableOpacity
                      onPress={handleToggle}
                      style={localStyles.toggleContainer}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={isActive ? `Deactivate ${activityName}` : `Activate ${activityName}`}
                    >
                      <View style={[localStyles.toggle, { backgroundColor: isActive ? theme.button.primary.background : theme.input.border }]}>
                        <View style={[localStyles.toggleThumb, { backgroundColor: theme.background.primary, transform: [{ translateX: isActive ? 20 : 0 }] }]} />
                      </View>
                    </TouchableOpacity>
                    <View ref={menuButtonRef}>
                      <TouchableOpacity onPress={handleMenuPress} style={localStyles.menuButton} accessibilityRole="button" accessibilityLabel={`More options for ${activityName}`}>
                        <MaterialIcons name="more-horiz" size={20} color={theme.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {showActions && (
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={localStyles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            {menuButtonLayout && (() => {
              const screenWidth = Dimensions.get('window').width;
              const menuWidth = 200;
              const buttonRightEdge = menuButtonLayout.x + menuButtonLayout.width;
              let menuLeft = buttonRightEdge - menuWidth;
              menuLeft = Math.max(16, Math.min(menuLeft, screenWidth - menuWidth - 16));
              return (
                <View style={[localStyles.menuContainer, { backgroundColor: theme.background.modal, top: menuButtonLayout.y + menuButtonLayout.height + 4, left: menuLeft }]} onStartShouldSetResponder={() => true}>
                  <TouchableOpacity onPress={handleEditPress} style={[localStyles.menuItem, { borderBottomColor: theme.border.secondary }]} accessibilityRole="button" accessibilityLabel={`Edit ${activityName}`}>
                    <MaterialIcons name="edit" size={20} color={theme.button.icon.icon} />
                    <Text style={[localStyles.menuItemText, { color: theme.button.icon.icon }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeletePress} style={localStyles.menuItem} accessibilityRole="button" accessibilityLabel={`Delete ${activityName}`}>
                    <MaterialIcons name="delete" size={20} color={theme.button.icon.icon} />
                    <Text style={[localStyles.menuItemText, { color: theme.button.icon.icon }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  card: {
    padding: 0,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardContent: { gap: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 16 },
  titleBlock: { flex: 1, gap: 4 },
  activityName: { fontSize: 16, fontWeight: '600' },
  volumePeriodText: { fontSize: 14, fontWeight: '500' },
  sessionParamsText: { fontSize: 13 },
  headerActions: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  actionButtonsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  toggleContainer: { alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 50, height: 30, borderRadius: 15, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  menuButton: { padding: 6, alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuContainer: { position: 'absolute', borderRadius: 12, minWidth: 200, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
});

