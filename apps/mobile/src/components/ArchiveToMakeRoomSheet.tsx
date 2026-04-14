import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Standard } from '@minimum-standards/shared-model';
import { typography, BUTTON_BORDER_RADIUS, SCREEN_PADDING } from '@nine4/ui-kit';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme/useTheme';
import { MAX_ACTIVE_STANDARDS } from '../hooks/useStandards';

export interface ArchiveToMakeRoomSheetProps {
  visible: boolean;
  activeStandards: Standard[];
  onArchive: (standardId: string) => void;
  onRequestClose: () => void;
}

export function ArchiveToMakeRoomSheet({
  visible,
  activeStandards,
  onArchive,
  onRequestClose,
}: ArchiveToMakeRoomSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          You're at your {MAX_ACTIVE_STANDARDS} active standards
        </Text>
        <Text style={[styles.message, { color: theme.text.secondary }]}>
          Pick one to archive and make room.
        </Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {activeStandards.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onArchive(s.id)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border.secondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${s.name}`}
            >
              <Text style={[styles.rowName, { color: theme.text.primary }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.rowSummary, { color: theme.text.secondary }]} numberOfLines={1}>
                {s.summary}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={onRequestClose}
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: theme.border.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[styles.cancelText, { color: theme.text.primary }]}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: typography.header.small.fontSize,
    fontWeight: typography.header.small.fontWeight,
  },
  message: {
    fontSize: typography.text.small.fontSize,
    fontWeight: typography.text.small.fontWeight,
    marginTop: 8,
  },
  list: {
    marginTop: 16,
    maxHeight: 360,
  },
  listContent: {
    gap: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowName: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.text.body.fontWeight,
  },
  rowSummary: {
    fontSize: typography.text.small.fontSize,
    fontWeight: typography.text.small.fontWeight,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 16,
    height: 44,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelText: {
    fontSize: typography.button.primary.fontSize,
    fontWeight: typography.button.primary.fontWeight,
  },
  pressed: {
    opacity: 0.8,
  },
});
