import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { typography, SCREEN_PADDING } from '@nine4/ui-kit';
import { BottomSheet } from './BottomSheet';

export interface BottomSheetMenuItem {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface BottomSheetMenuProps {
  visible: boolean;
  onRequestClose: () => void;
  items: BottomSheetMenuItem[];
  title?: string;
}

export function BottomSheetMenu({ visible, onRequestClose, items, title }: BottomSheetMenuProps) {
  const theme = useTheme();

  const handleItemPress = useCallback(
    (onPress: () => void) => {
      onRequestClose();
      // Execute the action after the sheet has closed. The previous implementation
      // deferred via Modal.onDismiss, but that callback never fires because
      // BottomSheet unmounts the Modal when visible becomes false (and onDismiss
      // is iOS-only regardless). A short timeout lets the state update flush
      // before the action runs.
      setTimeout(onPress, 100);
    },
    [onRequestClose],
  );

  return (
    <BottomSheet visible={visible} onRequestClose={onRequestClose}>
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
        const color = theme.text.primary;
        const iconColor = theme.text.secondary;

        return (
          <View key={item.key}>
            <Pressable
              onPress={() => handleItemPress(item.onPress)}
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
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
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
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SCREEN_PADDING,
  },
});
