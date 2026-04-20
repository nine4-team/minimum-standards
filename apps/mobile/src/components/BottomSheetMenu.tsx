import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { typography, SCREEN_PADDING } from '@nine4/ui-kit';
import { BottomSheet } from './BottomSheet';

export interface BottomSheetMenuSubItem {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
}

export interface BottomSheetMenuItem {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Nested sub-items — tap parent to expand, tap sub-item to select & close. */
  subItems?: BottomSheetMenuSubItem[];
  /** Key of the currently selected sub-item (shows checkmark). */
  selectedSubItemKey?: string;
}

export interface BottomSheetMenuProps {
  visible: boolean;
  onRequestClose: () => void;
  items: BottomSheetMenuItem[];
  title?: string;
}

export function BottomSheetMenu({ visible, onRequestClose, items, title }: BottomSheetMenuProps) {
  const theme = useTheme();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Reset expanded state when the sheet closes
  const handleClose = useCallback(() => {
    setExpandedKey(null);
    onRequestClose();
  }, [onRequestClose]);

  const handleItemPress = useCallback(
    (item: BottomSheetMenuItem) => {
      if (item.subItems && item.subItems.length > 0) {
        setExpandedKey(prev => prev === item.key ? null : item.key);
        return;
      }
      handleClose();
      setTimeout(item.onPress, 100);
    },
    [handleClose],
  );

  const handleSubItemPress = useCallback(
    (onPress: () => void) => {
      handleClose();
      setTimeout(onPress, 100);
    },
    [handleClose],
  );

  return (
    <BottomSheet visible={visible} onRequestClose={handleClose}>
      {title != null && (
        <View
          style={[
            styles.titleRow,
            { borderBottomColor: theme.border.secondary, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={[styles.titleText, { color: theme.text.primary }]}>{title}</Text>
        </View>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const color = item.destructive ? theme.archive.text : theme.text.primary;
        const iconColor = item.destructive ? theme.archive.text : theme.text.secondary;
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isExpanded = expandedKey === item.key;

        return (
          <View key={item.key}>
            <Pressable
              onPress={() => handleItemPress(item)}
              disabled={item.disabled}
              style={({ pressed }) => [
                styles.item,
                item.disabled && styles.disabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              {item.icon != null && (
                <MaterialIcons name={item.icon} size={20} color={iconColor} style={styles.icon} />
              )}
              <Text style={[styles.label, { color }, hasSubItems && styles.labelFlex]}>{item.label}</Text>
              {hasSubItems && (
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={theme.text.secondary}
                />
              )}
            </Pressable>

            {hasSubItems && isExpanded && item.subItems!.map((sub) => {
              const isSelected = item.selectedSubItemKey === sub.key;
              return (
                <Pressable
                  key={sub.key}
                  onPress={() => handleSubItemPress(sub.onPress)}
                  style={({ pressed }) => [
                    styles.subItem,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={sub.label}
                >
                  {isSelected ? (
                    <MaterialIcons name="check" size={18} color={theme.primary.main} style={styles.subIcon} />
                  ) : (
                    <View style={styles.subIconPlaceholder} />
                  )}
                  <Text style={[
                    styles.subLabel,
                    { color: isSelected ? theme.primary.main : theme.text.primary },
                  ]}>
                    {sub.label}
                  </Text>
                </Pressable>
              );
            })}

            {!isLast && (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.border.secondary },
                ]}
              />
            )}
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
  },
  titleText: {
    fontSize: typography.header.small.fontSize,
    fontWeight: typography.header.small.fontWeight,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
  },
  icon: {
    marginRight: 12,
  },
  label: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.text.body.fontWeight,
  },
  labelFlex: {
    flex: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingLeft: SCREEN_PADDING + 32,
    paddingVertical: 12,
  },
  subIcon: {
    marginRight: 10,
  },
  subIconPlaceholder: {
    width: 18,
    marginRight: 10,
  },
  subLabel: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.text.body.fontWeight,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SCREEN_PADDING,
  },
});
