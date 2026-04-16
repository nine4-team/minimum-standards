import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { formatUnitWithCount } from '@minimum-standards/shared-model';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { SCREEN_PADDING, getCardBorderStyle, getCardBaseStyle } from '@nine4/ui-kit';

export interface ActivityLogEntryProps {
  value: number;
  unit: string;
  occurredAtMs: number;
  note: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ActivityLogEntry({
  value,
  unit,
  occurredAtMs,
  note,
  onEdit,
  onDelete,
}: ActivityLogEntryProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuButtonLayout, setMenuButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const menuButtonRef = useRef<View>(null);

  const formatTimestamp = (timestampMs: number): string => {
    const date = new Date(timestampMs);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${weekday} ${monthDay} ${time}`;
  };

  const handleMenuPress = () => {
    if (menuButtonRef.current) {
      menuButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuButtonLayout({ x: pageX, y: pageY, width, height });
        setMenuVisible(true);
      });
    }
  };

  const closeMenuAndRun = (action?: () => void) => {
    setMenuVisible(false);
    if (action) {
      setTimeout(action, 100);
    }
  };

  const handleEditPress = () => {
    closeMenuAndRun(onEdit);
  };

  const handleDeletePress = () => {
    closeMenuAndRun(onDelete);
  };

  const formattedValue = `${value} ${formatUnitWithCount(unit, value)}`;
  const formattedTimestamp = formatTimestamp(occurredAtMs);

  const showMenu = onEdit || onDelete;

  return (
    <>
    <View style={[
      styles.container,
      getCardBaseStyle({ radius: 12 }),
      getCardBorderStyle(theme),
      { backgroundColor: theme.background.card }
    ]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onEdit}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Edit log entry"
      >
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <Text style={[styles.value, { color: theme.text.primary }]}>
              {formattedValue}
            </Text>
            <Text style={[styles.timestamp, { color: theme.text.tertiary }]}>
              {formattedTimestamp}
            </Text>
          </View>
          {showMenu && (
            <View ref={menuButtonRef}>
              <TouchableOpacity
                onPress={handleMenuPress}
                style={styles.menuButton}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <MaterialIcons name="more-horiz" size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {note && (
          <Text style={[styles.note, { color: theme.text.secondary }]} numberOfLines={2}>
            {note}
          </Text>
        )}
      </TouchableOpacity>
    </View>

    <Modal
      visible={menuVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => closeMenuAndRun()}
    >
      <TouchableOpacity
        style={styles.menuOverlay}
        activeOpacity={1}
        onPress={() => closeMenuAndRun()}
      >
        {menuButtonLayout && (() => {
          const screenWidth = Dimensions.get('window').width;
          const menuWidth = 200;
          const buttonRightEdge = menuButtonLayout.x + menuButtonLayout.width;
          let menuLeft = buttonRightEdge - menuWidth;
          menuLeft = Math.max(SCREEN_PADDING, Math.min(menuLeft, screenWidth - menuWidth - SCREEN_PADDING));
          
          return (
            <View
              style={[
                styles.menuContainer,
                {
                  backgroundColor: theme.background.modal,
                  top: menuButtonLayout.y + menuButtonLayout.height + 4,
                  left: menuLeft,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {onEdit && (
                <TouchableOpacity
                  onPress={handleEditPress}
                  style={[styles.menuItem, onDelete ? { borderBottomColor: theme.border.secondary } : { borderBottomWidth: 0 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit log entry"
                >
                  <MaterialIcons name="edit" size={20} color={theme.button.icon.icon} />
                  <Text style={[styles.menuItemText, { color: theme.button.icon.icon }]}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={handleDeletePress}
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete log entry"
                >
                  <MaterialIcons name="delete" size={20} color={theme.button.icon.icon} />
                  <Text style={[styles.menuItemText, { color: theme.button.icon.icon }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}
      </TouchableOpacity>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  content: {
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    gap: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  menuButton: {
    padding: 4,
    marginRight: -4,
  },
  timestamp: {
    fontSize: 13,
    fontWeight: '500',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginTop: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    width: 200,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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