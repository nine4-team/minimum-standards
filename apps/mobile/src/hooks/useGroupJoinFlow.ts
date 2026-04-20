import { useEffect, useState } from 'react';
import { Alert, Linking, TextInput } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useGroupJoinStore } from '../stores/groupJoinStore';
import { extractGroupInviteCodeFromUrl } from '../utils/groupLinks';
import { useDisplayName } from './useDisplayName';
import * as groupsService from '../services/groupsService';
import { navigationRef } from '../navigation/navigationRef';

function navigateToGroupDetail(groupId: string) {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('Main', {
    screen: 'MainTabs',
    params: {
      screen: 'Groups',
      params: {
        screen: 'GroupDetail',
        params: { groupId },
      },
    },
  });
}

export function useGroupJoinFlow() {
  const { user } = useAuthStore();
  const { pendingInviteCode, setPendingInviteCode, clearPendingInviteCode } =
    useGroupJoinStore();
  const { displayName, loading: displayNameLoading } = useDisplayName();
  const [isJoining, setIsJoining] = useState(false);

  // Listen for deep links containing group invite codes
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) {
        return;
      }
      const code = extractGroupInviteCodeFromUrl(url);
      if (code) {
        setPendingInviteCode(code);
      }
    };

    Linking.getInitialURL()
      .then((url) => handleUrl(url))
      .catch(() => {});

    const listener = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => listener.remove();
  }, [setPendingInviteCode]);

  // Process pending invite code when user is signed in
  useEffect(() => {
    if (!user?.uid || !pendingInviteCode || isJoining || displayNameLoading) {
      return;
    }

    const joinWithCode = async (inviteCode: string, name: string) => {
      setIsJoining(true);
      try {
        const result = await groupsService.joinGroup(inviteCode, name);
        clearPendingInviteCode();
        navigateToGroupDetail(result.groupId);
      } catch (err: any) {
        clearPendingInviteCode();
        Alert.alert('Could not join group', err?.message || 'Something went wrong.');
      } finally {
        setIsJoining(false);
      }
    };

    if (displayName) {
      void joinWithCode(pendingInviteCode, displayName);
    } else {
      // Prompt for display name before joining
      Alert.prompt(
        'Set your display name',
        'Choose a name your group members will see.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => clearPendingInviteCode(),
          },
          {
            text: 'Join',
            onPress: (name) => {
              const trimmed = (name || '').trim();
              if (!trimmed) {
                clearPendingInviteCode();
                Alert.alert('Name required', 'A display name is required to join a group.');
                return;
              }
              void joinWithCode(pendingInviteCode, trimmed);
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
    }
  }, [user?.uid, pendingInviteCode, isJoining, displayNameLoading, displayName, clearPendingInviteCode]);
}
