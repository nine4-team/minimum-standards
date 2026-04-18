import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/useTheme';
import { useDisplayName } from '../hooks/useDisplayName';
import * as groupsService from '../services/groupsService';
import { SCREEN_PADDING, BUTTON_BORDER_RADIUS, getScreenContainerStyle } from '@nine4/ui-kit';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

export function JoinGroupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { displayName: existingDisplayName } = useDisplayName();

  const [inviteCode, setInviteCode] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsDisplayName = !existingDisplayName;

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    const dn = needsDisplayName ? displayNameInput.trim() : existingDisplayName;

    if (!code) {
      setError('Enter an invite code.');
      return;
    }
    if (!dn) {
      setError('Enter your display name.');
      return;
    }

    setJoining(true);
    setError(null);
    try {
      const data = await groupsService.joinGroup(code, dn);
      navigation.replace('GroupDetail', { groupId: data.groupId });
    } catch (err: any) {
      setError(err?.message || 'Failed to join group.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, getScreenContainerStyle(theme)]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.screen,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.text.secondary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Join Group</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>Invite Code</Text>
          <TextInput
            style={[
              styles.input,
              styles.codeInput,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
              },
            ]}
            placeholder="e.g., ABCD1234"
            placeholderTextColor={theme.input.placeholder}
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {needsDisplayName && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text.secondary }]}>Your Display Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.input.background,
                  borderColor: theme.input.border,
                  color: theme.input.text,
                },
              ]}
              placeholder="How your group sees you"
              placeholderTextColor={theme.input.placeholder}
              value={displayNameInput}
              onChangeText={setDisplayNameInput}
              maxLength={40}
            />
          </View>
        )}

        {error && (
          <Text style={[styles.errorText, { color: theme.input.borderError }]}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={handleJoin}
          disabled={joining}
          style={[
            styles.joinButton,
            { backgroundColor: theme.button.primary.background },
            joining && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.joinButtonText, { color: theme.button.primary.text }]}>
            {joining ? 'Joining...' : 'Join Group'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 64 },
  backButton: { fontSize: 16, fontWeight: '600' },
  form: { padding: SCREEN_PADDING, gap: 20 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorText: { fontSize: 14 },
  joinButton: {
    paddingVertical: 14,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  joinButtonText: { fontSize: 16, fontWeight: '600' },
});
