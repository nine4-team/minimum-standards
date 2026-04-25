import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { typography, BUTTON_BORDER_RADIUS, SCREEN_PADDING } from '@nine4/ui-kit';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme/useTheme';
import { useGroupJoinFlow } from '../hooks/useGroupJoinFlow';

/**
 * Cross-platform display-name prompt for the group join deep-link flow.
 *
 * Lives at the navigator root so the prompt is reachable regardless of which
 * stack is mounted when an invite link arrives. Replaces the previous
 * `Alert.prompt` call, which is iOS-only and silently no-ops on Android.
 */
export function GroupJoinPrompt() {
  const theme = useTheme();
  const { namePromptVisible, isJoining, submitName, cancelNamePrompt } =
    useGroupJoinFlow();
  const [name, setName] = useState('');

  useEffect(() => {
    if (namePromptVisible) {
      setName('');
    }
  }, [namePromptVisible]);

  return (
    <BottomSheet visible={namePromptVisible} onRequestClose={cancelNamePrompt}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Set your display name
        </Text>
        <Text style={[styles.message, { color: theme.text.secondary }]}>
          Choose a name your group members will see.
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
            },
          ]}
          placeholder="Your display name"
          placeholderTextColor={theme.input.placeholder}
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoFocus
          editable={!isJoining}
          returnKeyType="done"
          onSubmitEditing={() => submitName(name)}
        />

        <View style={styles.buttonRow}>
          <Pressable
            onPress={cancelNamePrompt}
            disabled={isJoining}
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              { borderColor: theme.border.primary },
              (pressed || isJoining) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.buttonText, { color: theme.text.primary }]}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={() => submitName(name)}
            disabled={isJoining}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.button.primary.background },
              (pressed || isJoining) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Join group"
          >
            <Text style={[styles.buttonText, { color: theme.button.primary.text }]}>
              {isJoining ? 'Joining...' : 'Join'}
            </Text>
          </Pressable>
        </View>
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
  input: {
    marginTop: 16,
    height: 44,
    borderWidth: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: 12,
    fontSize: typography.text.body.fontSize,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: typography.button.primary.fontSize,
    fontWeight: typography.button.primary.fontWeight,
  },
  pressed: {
    opacity: 0.8,
  },
});
