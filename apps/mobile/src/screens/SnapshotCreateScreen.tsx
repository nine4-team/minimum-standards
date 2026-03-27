import React, { useMemo, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import { getScreenContainerStyle } from '@nine4/ui-kit';
import { useStandards } from '../hooks/useStandards';
import { useCategories } from '../hooks/useCategories';
import { useSnapshots } from '../hooks/useSnapshots';
import { buildSnapshotPayload } from '../utils/snapshotImport';
import type { SettingsStackParamList } from '../navigation/types';

type SnapshotMode = 'custom' | 'everything';

export function SnapshotCreateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { standards } = useStandards();

  const { categories } = useCategories();
  const { createSnapshot } = useSnapshots();

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<SnapshotMode>('custom');
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const activeStandardIds = useMemo(
    () =>
      standards
        .filter((standard) => standard.state === 'active' && standard.archivedAtMs == null)
        .map((standard) => standard.id),
    [standards]
  );

  const selectedStandardIds = useMemo(() => {
    return mode === 'everything' ? activeStandardIds : Array.from(selectedStandards);
  }, [mode, activeStandardIds, selectedStandards]);

  const payload = useMemo(() => {
    return buildSnapshotPayload({
      standards,
      categories,
      selectedStandardIds,
    });
  }, [standards, categories, selectedStandardIds]);

  const countsLabel = `${payload.standards.length} standards · ${payload.categories.length} categories`;

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
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Snapshot name required', 'Give your snapshot a name.');
      return;
    }
    if (payload.standards.length === 0) {
      if (mode === 'everything') {
        Alert.alert('No active standards', 'Add an active standard before creating this snapshot.');
      } else if (standards.length === 0) {
        Alert.alert('No standards yet', 'Create a standard before making a snapshot.');
      } else {
        Alert.alert('Select standards', 'Pick at least one standard.');
      }
      return;
    }

    try {
      setSaving(true);
      const created = await createSnapshot({ title: trimmedTitle, payload });
      navigation.replace('SnapshotDetail', { snapshotId: created.id });
    } catch (error) {
      Alert.alert(
        'Snapshot failed',
        error instanceof Error ? error.message : 'Unable to create snapshot'
      );
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Create Snapshot</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Mode</Text>
          <View style={styles.modeRow}>
            {(['custom', 'everything'] as SnapshotMode[]).map((option) => {
              const isActive = mode === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modeButton,
                    {
                      borderColor: isActive ? theme.button.primary.background : theme.border.secondary,
                      backgroundColor: isActive ? theme.background.tertiary : 'transparent',
                    },
                  ]}
                  onPress={() => setMode(option)}
                >
                  <Text style={[styles.modeButtonText, { color: theme.text.primary }]}>
                    {option === 'custom' ? 'Custom' : 'Everything'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.helperText, { color: theme.text.secondary }]}>
            {mode === 'custom'
              ? 'Pick standards and we will include required categories.'
              : 'Includes all active standards and their categories.'}
          </Text>
          <Text style={[styles.countsText, { color: theme.text.primary }]}>{countsLabel}</Text>
        </View>

        {mode === 'custom' && (
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
        )}
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
            <Text style={[styles.saveButtonText, { color: theme.button.primary.text }]}>Create</Text>
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
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
  },
  countsText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
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
