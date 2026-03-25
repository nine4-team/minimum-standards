import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useSnapshotShareStore } from '../stores/snapshotShareStore';
import { extractShareCodeFromUrl } from '../utils/snapshotLinks';
import { importSnapshotForUser, SnapshotImportError } from '../utils/snapshotImport';

export function useSnapshotImportFlow() {
  const { user } = useAuthStore();
  const { pendingShareCode, setPendingShareCode, clearPendingShareCode, markProcessed } =
    useSnapshotShareStore();
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) {
        return;
      }
      const shareCode = extractShareCodeFromUrl(url);
      if (shareCode) {
        setPendingShareCode(shareCode);
      }
    };

    Linking.getInitialURL()
      .then((url) => handleUrl(url))
      .catch(() => {
        // ignore
      });

    const listener = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => listener.remove();
  }, [setPendingShareCode]);

  useEffect(() => {
    if (!user?.uid || !pendingShareCode || isImporting) {
      return;
    }

    const runImport = async () => {
      setIsImporting(true);
      try {
        const result = await importSnapshotForUser({
          userId: user.uid,
          shareCode: pendingShareCode,
        });

        markProcessed(pendingShareCode);
        clearPendingShareCode();

        if (result.isOwnSnapshot) {
          Alert.alert(
            'This is your snapshot',
            'You created this snapshot — share the link with someone else to let them import it.'
          );
          return;
        }

        if (result.alreadyInstalled) {
          Alert.alert('Already imported', 'You have already imported this snapshot.');
          return;
        }

        const { standards, activities, categories } = result.createdCounts;
        const parts: string[] = [];
        if (standards > 0) parts.push(`${standards} standard${standards !== 1 ? 's' : ''}`);
        if (activities > 0) parts.push(`${activities} activit${activities !== 1 ? 'ies' : 'y'}`);
        if (categories > 0) parts.push(`${categories} categor${categories !== 1 ? 'ies' : 'y'}`);

        if (parts.length === 0) {
          Alert.alert(
            'Nothing new to add',
            'You already have matching standards, so nothing was imported.'
          );
        } else {
          Alert.alert('Snapshot imported', `Added ${parts.join(', ')}.`);
        }
      } catch (error) {
        const shareCode = pendingShareCode;
        clearPendingShareCode();

        if (error instanceof SnapshotImportError) {
          const messages: Record<string, { title: string; message: string }> = {
            'share-link-not-found': { title: 'Link not found', message: 'This share link is invalid or has expired.' },
            'share-link-disabled': { title: 'Link disabled', message: 'This share link has been turned off.' },
            'snapshot-not-found': { title: 'Snapshot missing', message: 'This snapshot is no longer available.' },
            'snapshot-deleted': { title: 'Snapshot deleted', message: 'This snapshot was removed by the owner.' },
            'snapshot-disabled': { title: 'Snapshot disabled', message: 'This snapshot is not shareable right now.' },
            'payload-missing': { title: 'Snapshot unavailable', message: 'This snapshot is missing data needed to import.' },
            'payload-invalid': { title: 'Snapshot unavailable', message: 'This snapshot is missing data needed to import.' },
            'payload-empty': { title: 'Snapshot unavailable', message: 'This snapshot has no standards to import.' },
          };
          const known = messages[error.code];
          if (known) {
            Alert.alert(known.title, known.message);
            return;
          }
        }

        // Unknown/transient error — show the raw message and allow retry
        const rawMessage = error instanceof Error ? error.message : String(error);
        Alert.alert('Import failed', rawMessage, [
          { text: 'Try again', onPress: () => setPendingShareCode(shareCode) },
          { text: 'Dismiss', style: 'cancel' },
        ]);
      } finally {
        setIsImporting(false);
      }
    };

    void runImport();
  }, [user?.uid, pendingShareCode, isImporting, clearPendingShareCode, markProcessed]);
}
