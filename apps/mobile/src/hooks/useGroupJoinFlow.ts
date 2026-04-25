import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useGroupJoinStore } from '../stores/groupJoinStore';
import { extractGroupInviteCodeFromUrl } from '../utils/groupLinks';
import { useDisplayName } from './useDisplayName';
import * as groupsService from '../services/groupsService';
import { navigationRef, waitForNavigationReady } from '../navigation/navigationRef';

async function navigateToGroupDetail(groupId: string) {
  const ready = await waitForNavigationReady();
  if (!ready) {
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

export interface GroupJoinFlowState {
  /** True while the user must supply a display name to complete the join. */
  namePromptVisible: boolean;
  /** True while the join request is in flight. */
  isJoining: boolean;
  /** Submit the supplied name and complete the join. */
  submitName: (name: string) => void;
  /** Dismiss the prompt and discard the pending invite. */
  cancelNamePrompt: () => void;
}

export function useGroupJoinFlow(): GroupJoinFlowState {
  const { user } = useAuthStore();
  const { pendingInviteCode, setPendingInviteCode, clearPendingInviteCode } =
    useGroupJoinStore();
  const { displayName, loading: displayNameLoading } = useDisplayName();
  const [isJoining, setIsJoining] = useState(false);
  const [namePromptVisible, setNamePromptVisible] = useState(false);

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

  const joinWithCode = useCallback(
    async (inviteCode: string, name: string) => {
      setIsJoining(true);
      try {
        const result = await groupsService.joinGroup(inviteCode, name);
        clearPendingInviteCode();
        await navigateToGroupDetail(result.groupId);
      } catch (err: any) {
        clearPendingInviteCode();
        Alert.alert('Could not join group', err?.message || 'Something went wrong.');
      } finally {
        setIsJoining(false);
      }
    },
    [clearPendingInviteCode]
  );

  // Process pending invite code when user is signed in
  useEffect(() => {
    if (!user?.uid || !pendingInviteCode || isJoining || displayNameLoading) {
      return;
    }

    if (displayName) {
      setNamePromptVisible(false);
      void joinWithCode(pendingInviteCode, displayName);
    } else {
      setNamePromptVisible(true);
    }
  }, [
    user?.uid,
    pendingInviteCode,
    isJoining,
    displayNameLoading,
    displayName,
    joinWithCode,
  ]);

  const submitName = useCallback(
    (name: string) => {
      const trimmed = (name || '').trim();
      if (!trimmed) {
        Alert.alert('Name required', 'A display name is required to join a group.');
        return;
      }
      if (!pendingInviteCode) {
        setNamePromptVisible(false);
        return;
      }
      setNamePromptVisible(false);
      void joinWithCode(pendingInviteCode, trimmed);
    },
    [pendingInviteCode, joinWithCode]
  );

  const cancelNamePrompt = useCallback(() => {
    setNamePromptVisible(false);
    clearPendingInviteCode();
  }, [clearPendingInviteCode]);

  return { namePromptVisible, isJoining, submitName, cancelNamePrompt };
}
