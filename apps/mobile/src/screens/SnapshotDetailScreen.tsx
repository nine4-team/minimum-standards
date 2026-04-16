import React, { useEffect, useMemo, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getScreenContainerStyle } from '@nine4/ui-kit';
import { useSnapshots } from '../hooks/useSnapshots';
import { buildSnapshotShareUrl } from '../utils/snapshotLinks';
import { shareSnapshotLink } from '../utils/shareSnapshotLink';
import type { SettingsStackParamList } from '../navigation/types';
import type { ShareLinkRecord, SnapshotStandard, SnapshotStandardV2 } from '../types/snapshots';

export function SnapshotDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'SnapshotDetail'>>();
  const headerButtonWidth = 44;
  const {
    snapshots,
    toggleSnapshotEnabled,
    getOrCreateShareLink,
    regenerateShareLink,
    fetchShareLinkForSnapshot,
    deleteSnapshot,
  } = useSnapshots();
  const [shareLink, setShareLink] = useState<ShareLinkRecord | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const snapshot = useMemo(
    () => snapshots.find((item) => item.id === route.params.snapshotId) ?? null,
    [snapshots, route.params.snapshotId]
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    fetchShareLinkForSnapshot(snapshot.id)
      .then((link) => setShareLink(link))
      .catch(() => {
        setShareLink(null);
      });
  }, [snapshot, fetchShareLinkForSnapshot]);

  const handleShare = async () => {
    if (!snapshot) {
      return;
    }
    setSharing(true);
    try {
      if (!snapshot.isEnabled) {
        Alert.alert('Sharing disabled', 'Turn on sharing to use this link.');
        return;
      }
      const link = await getOrCreateShareLink(snapshot.id);
      setShareLink(link);
      const url = buildSnapshotShareUrl(link.shareCode);
      await shareSnapshotLink({ url, snapshotTitle: snapshot.title });
    } catch (error) {
      Alert.alert(
        'Share failed',
        error instanceof Error ? error.message : 'Unable to share snapshot'
      );
    } finally {
      setSharing(false);
    }
  };

  const confirmDelete = () => {
    if (!snapshot || deleting) {
      return;
    }
    Alert.alert(
      'Delete snapshot?',
      'This removes the snapshot and disables its share link. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteSnapshot(snapshot.id);
              Alert.alert('Snapshot deleted', 'The snapshot was removed.');
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Delete failed',
                error instanceof Error ? error.message : 'Unable to delete snapshot'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleRegenerate = async () => {
    if (!shareLink) {
      return;
    }
    if (!snapshot?.isEnabled) {
      Alert.alert('Sharing disabled', 'Turn on sharing to regenerate this link.');
      return;
    }
    try {
      const updated = await regenerateShareLink(shareLink.id);
      setShareLink(updated);
      Alert.alert('Link regenerated', 'Your old link is now disabled.');
    } catch (error) {
      Alert.alert(
        'Regenerate failed',
        error instanceof Error ? error.message : 'Unable to regenerate link'
      );
    }
  };

  const closeHeaderMenu = () => {
    setHeaderMenuVisible(false);
  };

  const activityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const payload = snapshot?.payload;
    if (payload && 'activities' in payload && payload.activities) {
      payload.activities.forEach((activity) => {
        map.set(activity.id, activity.name);
      });
    }
    return map;
  }, [snapshot]);
  const formatStandardSummary = (standard: SnapshotStandard | SnapshotStandardV2) => {
    const { interval, unit: cadenceUnit } = standard.cadence;
    const cadenceLabel = interval === 1 ? cadenceUnit : `${interval} ${cadenceUnit}s`;
    const base = `${standard.minimum} ${standard.unit} per ${cadenceLabel}`;
    const sessions = standard.sessionConfig?.sessionsPerCadence;
    if (!sessions) {
      return base;
    }
    const sessionLabel = standard.sessionConfig?.sessionLabel ?? 'sessions';
    return `${base} · ${sessions} ${sessionLabel}`;
  };

  if (!snapshot) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.screen }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.background.chrome,
              borderBottomColor: theme.border.secondary,
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconButton}
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Snapshot</Text>
          <View style={[styles.headerRightActions, { width: headerButtonWidth * 2 }]} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.button.primary.background} />
        </View>
      </View>
    );
  }

  const shareDisabled = sharing || !snapshot.isEnabled;

  return (
    <View style={[styles.container, getScreenContainerStyle(theme)]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.chrome,
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconButton}
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>{snapshot.title}</Text>
        <View style={[styles.headerRightActions, { width: headerButtonWidth * 2 }]}>
          <TouchableOpacity
            onPress={() => {
              closeHeaderMenu();
              handleShare();
            }}
            style={styles.headerActionButton}
            accessibilityRole="button"
            accessibilityLabel="Share snapshot"
            disabled={shareDisabled}
          >
            <MaterialIcons
              name="share"
              size={22}
              color={shareDisabled ? theme.text.secondary : theme.button.primary.background}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setHeaderMenuVisible(true)}
            style={styles.headerActionButton}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MaterialIcons name="more-horiz" size={24} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {headerMenuVisible && (
        <TouchableOpacity
          style={[
            styles.menuOverlay,
            { paddingTop: Math.max(insets.top, 12) + 44 },
          ]}
          activeOpacity={1}
          onPress={closeHeaderMenu}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <View
            style={[
              styles.menuContainer,
              { backgroundColor: theme.background.modal, borderColor: theme.border.secondary },
            ]}
          >
            {shareLink && (
              <TouchableOpacity
                onPress={() => {
                  closeHeaderMenu();
                  handleRegenerate();
                }}
                style={[styles.menuActionItem, shareDisabled && styles.menuItemDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Regenerate Link"
                disabled={shareDisabled}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    { color: shareDisabled ? theme.text.secondary : theme.text.primary },
                  ]}
                >
                  Regenerate Link
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                closeHeaderMenu();
                toggleSnapshotEnabled(snapshot.id, !snapshot.isEnabled);
              }}
              style={styles.menuActionItem}
              accessibilityRole="button"
              accessibilityLabel={snapshot.isEnabled ? 'Turn Off Sharing' : 'Turn On Sharing'}
            >
              <Text style={[styles.menuItemText, { color: theme.text.primary }]}>
                {snapshot.isEnabled ? 'Turn Off Sharing' : 'Turn On Sharing'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.border.secondary }]} />

            <TouchableOpacity
              onPress={() => {
                closeHeaderMenu();
                navigation.navigate('SnapshotEdit', { snapshotId: snapshot.id });
              }}
              style={styles.menuActionItem}
              accessibilityRole="button"
              accessibilityLabel="Edit Snapshot"
            >
              <Text style={[styles.menuItemText, { color: theme.text.primary }]}>Edit Snapshot</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.border.secondary }]} />

            <TouchableOpacity
              onPress={() => {
                closeHeaderMenu();
                confirmDelete();
              }}
              style={styles.menuActionItem}
              accessibilityRole="button"
              accessibilityLabel="Delete Snapshot"
              disabled={deleting}
            >
              <Text
                style={[
                  styles.menuItemText,
                  { color: deleting ? theme.text.secondary : theme.status.missed.text },
                ]}
              >
                Delete Snapshot
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Standards</Text>
          {snapshot.payload.standards.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No standards.</Text>
          ) : (
            snapshot.payload.standards.map((standard, index) => {
              const activityName = 'name' in standard
                ? (standard as SnapshotStandardV2).name
                : activityNameMap.get((standard as SnapshotStandard).activityId) ?? 'Standard';
              return (
                <View
                  key={standard.id}
                  style={[
                    styles.listRow,
                    {
                      borderBottomColor: theme.border.secondary,
                      borderBottomWidth:
                        index !== snapshot.payload.standards.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.listInfo}>
                    <Text style={[styles.listTitle, { color: theme.text.primary }]}>
                      {activityName}
                    </Text>
                    <Text style={[styles.listSubtitle, { color: theme.text.secondary }]}>
                      {formatStandardSummary(standard)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

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
  headerIconButton: {
    width: 88,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  headerActionButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
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
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  listRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listInfo: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  listSubtitle: {
    fontSize: 13,
  },
  listNotes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  menuContainer: {
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 220,
    maxWidth: 280,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuDivider: {
    height: 1,
    opacity: 0.6,
  },
});
