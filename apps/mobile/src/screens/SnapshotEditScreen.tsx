import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getScreenContainerStyle } from '@nine4/ui-kit';
import { useStandards } from '../hooks/useStandards';
import { useSnapshots } from '../hooks/useSnapshots';
import { buildSnapshotPayload } from '../utils/snapshotImport';
import type { SettingsStackParamList } from '../navigation/types';

export function SnapshotEditScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'SnapshotEdit'>>();
  const { standards } = useStandards();
  const { snapshots, updateSnapshotTitle, updateSnapshotPayload } = useSnapshots();

  const snapshot = useMemo(
    () => snapshots.find((item) => item.id === route.params.snapshotId) ?? null,
    [snapshots, route.params.snapshotId]
  );

  const [title, setTitle] = useState('');
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!snapshot || initialized) {
      return;
    }
    setTitle(snapshot.title);
    setSelectedStandards(new Set(snapshot.payload.standards.map((standard) => standard.id)));
    setInitialized(true);
  }, [snapshot, initialized]);

  const availableStandardIds = useMemo(() => {
    return new Set(standards.map((standard) => standard.id));
  }, [standards]);

  const selectedStandardIds = useMemo(() => {
    return Array.from(selectedStandards).filter((id) => availableStandardIds.has(id));
  }, [selectedStandards, availableStandardIds]);

  const payload = useMemo(() => {
    return buildSnapshotPayload({
      standards,
      selectedStandardIds,
    });
  }, [standards, selectedStandardIds]);

  const countsLabel = `${payload.standards.length} standards`;

  const snapshotStandardIds = useMemo(() => {
    return new Set(snapshot?.payload.standards.map((standard) => standard.id) ?? []);
  }, [snapshot]);

  const isContentChanged = useMemo(() => {
    if (!snapshot) {
      return false;
    }
    if (snapshotStandardIds.size !== selectedStandardIds.length) {
      return true;
    }
    return selectedStandardIds.some((id) => !snapshotStandardIds.has(id));
  }, [snapshot, snapshotStandardIds, selectedStandardIds]);

  const trimmedTitle = title.trim();
  const isTitleChanged = snapshot ? trimmedTitle !== snapshot.title : false;

  const toggleStandard = (standardId: string) => {
    setSelectedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!snapshot) {
      return;
    }
    if (!trimmedTitle) {
      Alert.alert('Snapshot name required', 'Give your snapshot a name.');
      return;
    }
    if (payload.standards.length === 0) {
      if (standards.length === 0) {
        Alert.alert('No standards yet', 'Create a standard before saving this snapshot.');
      } else {
        Alert.alert('Select standards', 'Pick at least one standard.');
      }
      return;
    }
    if (!isTitleChanged && !isContentChanged) {
      navigation.goBack();
      return;
    }

    try {
      setSaving(true);
      if (isContentChanged) {
        await updateSnapshotPayload({
          snapshotId: snapshot.id,
          payload,
          nextVersion: snapshot.version + 1,
        });
      }
      if (isTitleChanged) {
        await updateSnapshotTitle(snapshot.id, trimmedTitle);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Update failed',
        error instanceof Error ? error.message : 'Unable to update snapshot'
      );
    } finally {
      setSaving(false);
    }
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
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Edit Snapshot</Text>
          <View style={styles.headerSpacer} />
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
            backgroundColor: theme.background.chrome,
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Edit Snapshot</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
              },
            ]}
            placeholder="Snapshot name"
            placeholderTextColor={theme.input.placeholder}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Contents</Text>
          <Text style={[styles.helperText, { color: theme.text.secondary }]}>
            Pick standards to include.
          </Text>
          <Text style={[styles.countsText, { color: theme.text.primary }]}>{countsLabel}</Text>
          <Text style={[styles.helperNote, { color: theme.text.secondary }]}>
            Edits update the existing share link automatically.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Standards</Text>
          {standards.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No standards yet.</Text>
          ) : (
            standards.map((standard, index) => {
              const standardName = standard.name;
              const isSelected = selectedStandards.has(standard.id);
              return (
                <TouchableOpacity
                  key={standard.id}
                  style={[
                    styles.standardRow,
                    {
                      borderBottomColor: theme.border.secondary,
                      borderBottomWidth: index !== standards.length - 1 ? 1 : 0,
                    },
                  ]}
                  onPress={() => toggleStandard(standard.id)}
                >
                  <View style={styles.standardInfo}>
                    <Text style={[styles.standardTitle, { color: theme.text.primary }]}>{standardName}</Text>
                    <Text style={[styles.standardSubtitle, { color: theme.text.secondary }]}>
                      {standard.summary}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                    size={22}
                    color={isSelected ? theme.button.primary.background : theme.text.tertiary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border.secondary, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.button.primary.background },
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.button.primary.text} />
          ) : (
            <Text style={[styles.saveButtonText, { color: theme.button.primary.text }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
  },
  countsText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  helperNote: {
    marginTop: 8,
    fontSize: 12,
  },
  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  standardInfo: {
    flex: 1,
    paddingRight: 12,
    gap: 4,
  },
  standardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  standardSubtitle: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
