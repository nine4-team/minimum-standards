import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
// Note: Clipboard requires @react-native-clipboard/clipboard package (not installed yet)
// Using Alert as a fallback for copy action
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { useDisplayName } from '../hooks/useDisplayName';
import * as groupsService from '../services/groupsService';
import { buildGroupJoinUrl } from '../utils/groupLinks';
import { SCREEN_PADDING, BUTTON_BORDER_RADIUS, getScreenContainerStyle } from '@nine4/ui-kit';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList>;

export function CreateGroupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { displayName: existingDisplayName } = useDisplayName();

  const [groupName, setGroupName] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  const needsDisplayName = !existingDisplayName;

  const handleCreate = async () => {
    const name = groupName.trim();
    const dn = needsDisplayName ? displayNameInput.trim() : existingDisplayName;

    if (!name) {
      setError('Enter a group name.');
      return;
    }
    if (!dn) {
      setError('Enter your display name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await groupsService.createGroup(name, dn);
      setCreatedInviteCode(data.inviteCode);
      setCreatedGroupId(data.groupId);
    } catch (err: any) {
      setError(err?.message || 'Failed to create group.');
    } finally {
      setSaving(false);
    }
  };

  const handleShareLink = async () => {
    if (createdInviteCode) {
      const url = buildGroupJoinUrl(createdInviteCode);
      await Share.share({
        message: `Join my accountability group "${groupName}" on Minimum Standards!\n${url}`,
      });
    }
  };

  const handleDone = () => {
    if (createdGroupId) {
      navigation.replace('GroupDetail', { groupId: createdGroupId });
    } else {
      navigation.goBack();
    }
  };

  // Success state: show invite code
  if (createdInviteCode) {
    return (
      <View style={[styles.screen, getScreenContainerStyle(theme)]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.background.screen,
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
        >
          <View style={styles.headerSpacer} />
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Group Created</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={56} color={theme.status.met.barComplete} />
          <Text style={[styles.successTitle, { color: theme.text.primary }]}>
            {groupName}
          </Text>
          <Text style={[styles.successText, { color: theme.text.secondary }]}>
            Share the invite link with your group.
          </Text>
          <TouchableOpacity
            onPress={handleShareLink}
            style={[styles.shareButton, { backgroundColor: theme.button.primary.background }]}
          >
            <MaterialIcons name="share" size={18} color={theme.button.primary.text} />
            <Text style={[styles.shareButtonText, { color: theme.button.primary.text }]}>
              Share Invite Link
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDone} style={styles.doneLink}>
            <Text style={[styles.doneLinkText, { color: theme.text.secondary }]}>Go to group</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Create Group</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>Group Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
              },
            ]}
            placeholder="e.g., Morning Crew"
            placeholderTextColor={theme.input.placeholder}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
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
          onPress={handleCreate}
          disabled={saving}
          style={[
            styles.createButton,
            { backgroundColor: theme.button.primary.background },
            saving && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.createButtonText, { color: theme.button.primary.text }]}>
            {saving ? 'Creating...' : 'Create Group'}
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
  errorText: { fontSize: 14 },
  createButton: {
    paddingVertical: 14,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  createButtonText: { fontSize: 16, fontWeight: '600' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  successTitle: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  successText: { fontSize: 15, textAlign: 'center' },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: BUTTON_BORDER_RADIUS,
    marginTop: 8,
  },
  shareButtonText: { fontSize: 16, fontWeight: '600' },
  doneLink: { marginTop: 16 },
  doneLinkText: { fontSize: 15 },
});
