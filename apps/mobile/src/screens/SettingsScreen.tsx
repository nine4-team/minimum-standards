import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../navigation/types';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '../stores/authStore';
import { AuthError } from '../utils/errors';
import { logAuthErrorToCrashlytics } from '../utils/crashlytics';
import { useTheme } from '../theme/useTheme';
import { getCardBorderStyle, getCardBaseStyle, getSectionTitleStyle, getScreenContainerStyle, getScreenHeaderStyle } from '@nine4/ui-kit';
import { useUIPreferencesStore, ThemePreference } from '../stores/uiPreferencesStore';
import { useDisplayName } from '../hooks/useDisplayName';

export function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { signOut } = useAuthStore();
  const { themePreference, setThemePreference } = useUIPreferencesStore();
  const { displayName, loading: displayNameLoading, setDisplayName } = useDisplayName();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartEditName = () => {
    setNameInput(displayName || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await setDisplayName(trimmed);
      setEditingName(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to update display name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut();
      // Navigation will be handled by AppNavigator based on auth state
    } catch (err) {
      const authError = AuthError.fromFirebaseError(err);
      logAuthErrorToCrashlytics(authError, 'sign_out');
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  };

  const themeOptions: { label: string; value: ThemePreference }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Auto', value: 'system' },
  ];

  return (
    <View style={[styles.container, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, getScreenHeaderStyle(theme, insets)]}>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[
          styles.card,
          getCardBaseStyle({ radius: 12 }),
          getCardBorderStyle(theme),
          { backgroundColor: theme.background.surface }
        ]}>
          {editingName ? (
            <View style={styles.optionRow}>
              <View style={styles.optionLabelContainer}>
                <MaterialIcons name="person" size={22} color={theme.text.primary} style={styles.optionIcon} />
                <TextInput
                  style={[styles.nameInput, { color: theme.text.primary, borderColor: theme.input.border }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  maxLength={40}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  onBlur={handleSaveName}
                  editable={!savingName}
                  placeholder="Display name"
                  placeholderTextColor={theme.input.placeholder}
                />
              </View>
              {savingName ? (
                <ActivityIndicator size="small" color={theme.text.secondary} />
              ) : (
                <TouchableOpacity onPress={handleSaveName}>
                  <MaterialIcons name="check" size={24} color={theme.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.optionRow} onPress={handleStartEditName}>
              <View style={styles.optionLabelContainer}>
                <MaterialIcons name="person" size={22} color={theme.text.primary} style={styles.optionIcon} />
                <View>
                  <Text style={[styles.optionLabel, { color: theme.text.primary }]}>
                    {displayNameLoading ? '...' : displayName || 'Set Display Name'}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="edit" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[
          styles.card,
          getCardBaseStyle({ radius: 12 }),
          getCardBorderStyle(theme),
          { backgroundColor: theme.background.surface }
        ]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => navigation.navigate('StandardsLibrary')}
          >
            <View style={styles.optionLabelContainer}>
              <MaterialIcons name="tune" size={22} color={theme.text.primary} style={styles.optionIcon} />
              <Text style={[styles.optionLabel, { color: theme.text.primary }]}>Manage Standards</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={[
          styles.card,
          getCardBaseStyle({ radius: 12 }),
          getCardBorderStyle(theme),
          { backgroundColor: theme.background.surface }
        ]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => navigation.navigate('Snapshots')}
          >
            <View style={styles.optionLabelContainer}>
              <MaterialIcons name="share" size={22} color={theme.text.primary} style={styles.optionIcon} />
              <Text style={[styles.optionLabel, { color: theme.text.primary }]}>Manage Snapshots</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={[
          styles.card,
          getCardBaseStyle({ radius: 12 }),
          getCardBorderStyle(theme),
          { backgroundColor: theme.background.surface, padding: 8 }
        ]}>
          <View style={[styles.segmentedControl, { backgroundColor: theme.background.screen }]}>
            {themeOptions.map((option) => {
              const selected = themePreference === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segment,
                    selected && { backgroundColor: theme.background.surface, shadowColor: theme.shadow },
                  ]}
                  onPress={() => setThemePreference(option.value)}
                >
                  <Text style={[
                    styles.segmentLabel,
                    { color: selected ? theme.text.primary : theme.text.secondary },
                    selected && styles.segmentLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.signOutButton,
            getCardBaseStyle({ radius: 12 }),
            getCardBorderStyle(theme),
            { backgroundColor: theme.background.surface }
          ]}
          onPress={handleSignOut}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.button.primary.background} />
          ) : (
            <>
              <MaterialIcons name="logout" size={20} color={theme.text.secondary} style={styles.signOutIcon} />
              <Text style={[styles.signOutLabel, { color: theme.text.secondary }]}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Style comes from getScreenContainerStyle helper
  },
  header: {
    // Base style comes from getScreenHeaderStyle helper
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 24,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    // Style comes from getSectionTitleStyle helper
  },
  card: {
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionBorder: {
    borderBottomWidth: 1,
  },
  optionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  segmentLabelSelected: {
    fontWeight: '600',
  },
  errorContainer: {
    borderRadius: 12,
    padding: 24,
    marginTop: 8,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
});
