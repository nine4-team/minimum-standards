import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getScreenContainerStyle } from '@nine4/ui-kit';
import { useSnapshots } from '../hooks/useSnapshots';
import { buildSnapshotShareUrl } from '../utils/snapshotLinks';
import { shareSnapshotLink } from '../utils/shareSnapshotLink';
import type { SettingsStackParamList } from '../navigation/types';

export function SnapshotsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { snapshots, loading, error, toggleSnapshotEnabled, getOrCreateShareLink } = useSnapshots();
  const [sharingSnapshotId, setSharingSnapshotId] = useState<string | null>(null);
  const snapshotTitleById = useCallback(
    (snapshotId: string) => snapshots.find((snapshot) => snapshot.id === snapshotId)?.title ?? 'snapshot',
    [snapshots]
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggle = useCallback(
    async (snapshotId: string, nextEnabled: boolean) => {
      try {
        await toggleSnapshotEnabled(snapshotId, nextEnabled);
      } catch (err) {
        console.error('[SnapshotsScreen] Failed to toggle snapshot', err);
      }
    },
    [toggleSnapshotEnabled]
  );
  const handleCreateSnapshot = useCallback(() => {
    navigation.navigate('SnapshotCreate');
  }, [navigation]);

  const handleShareSnapshot = useCallback(
    async (snapshotId: string, enabled: boolean) => {
      if (!enabled) {
        Alert.alert('Sharing disabled', 'Turn on sharing to use this link.');
        return;
      }
      setSharingSnapshotId(snapshotId);
      try {
        const link = await getOrCreateShareLink(snapshotId);
        const url = buildSnapshotShareUrl(link.shareCode);
        const snapshotTitle = snapshotTitleById(snapshotId);
        await shareSnapshotLink({ url, snapshotTitle });
      } catch (err) {
        Alert.alert('Share failed', err instanceof Error ? err.message : 'Unable to share snapshot');
      } finally {
        setSharingSnapshotId(null);
      }
    },
    [getOrCreateShareLink, snapshotTitleById]
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.screen }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.background.screen,
              borderBottomColor: theme.border.secondary,
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
        >
          <TouchableOpacity onPress={handleBack} accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Snapshots</Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.button.primary.background} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getScreenContainerStyle(theme)]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.screen,
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Snapshots</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity
          onPress={handleCreateSnapshot}
          style={[
            styles.createButton,
            { backgroundColor: theme.button.primary.background },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create Snapshot"
        >
          <MaterialIcons name="add" size={20} color={theme.button.primary.text} />
          <Text style={[styles.createButtonText, { color: theme.button.primary.text }]}>
            Create Snapshot
          </Text>
        </TouchableOpacity>
        {snapshots.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No snapshots yet.
          </Text>
        ) : (
          <View style={styles.listContainer}>
            {snapshots.map((snapshot) => {
              const isEnabled = snapshot.isEnabled;
              const shareDisabled = !isEnabled || sharingSnapshotId === snapshot.id;
              return (
                <TouchableOpacity
                  key={snapshot.id}
                  style={[
                    styles.snapshotCard,
                    {
                      backgroundColor: theme.background.surface,
                      borderColor: theme.border.secondary,
                    },
                  ]}
                  onPress={() => navigation.navigate('SnapshotDetail', { snapshotId: snapshot.id })}
                >
                  <View style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowTitle, { color: theme.text.primary }]}>
                        {snapshot.title}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        onPress={() => handleToggle(snapshot.id, !isEnabled)}
                        style={styles.toggleContainer}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: isEnabled }}
                      >
                        <View
                          style={[
                            styles.toggle,
                            {
                              backgroundColor: isEnabled
                                ? theme.button.primary.background
                                : theme.input.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.toggleThumb,
                              {
                                backgroundColor: theme.background.primary,
                                transform: [{ translateX: isEnabled ? 20 : 0 }],
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShareSnapshot(snapshot.id, isEnabled)}
                        style={styles.shareButton}
                        accessibilityRole="button"
                        accessibilityLabel="Share snapshot"
                        disabled={shareDisabled}
                      >
                        <MaterialIcons
                          name="share"
                          size={22}
                          color={
                            shareDisabled ? theme.text.secondary : theme.button.primary.background
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.background.card }]}>
            <Text style={[styles.errorText, { color: theme.input.borderError }]}>{error.message}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  listContainer: {
    gap: 12,
  },
  snapshotCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
  },
  errorText: {
    fontSize: 14,
  },
});
