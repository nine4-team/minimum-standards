import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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

export function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { signOut } = useAuthStore();
  const { themePreference, setThemePreference } = useUIPreferencesStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const themeOptions: { label: string; value: ThemePreference; icon: string }[] = [
    { label: 'Light', value: 'light', icon: 'light-mode' },
    { label: 'Dark', value: 'dark', icon: 'dark-mode' },
    { label: 'Auto', value: 'system', icon: 'brightness-auto' },
  ];

  return (
    <View style={[styles.container, getScreenContainerStyle(theme)]}>
      <View style={[styles.header, getScreenHeaderStyle(theme, insets)]}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Settings</Text>
        <TouchableOpacity
          style={styles.signOutIconContainer}
          onPress={handleSignOut}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.button.primary.background} />
          ) : (
            <MaterialIcons name="logout" size={24} color={theme.button.primary.background} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.sectionTitle, getSectionTitleStyle(theme)]}>Organization</Text>
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
              <MaterialIcons name="pending-actions" size={22} color={theme.text.primary} style={styles.optionIcon} />
              <Text style={[styles.optionLabel, { color: theme.text.primary }]}>Standards</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, getSectionTitleStyle(theme), { marginTop: 24 }]}>Sharing</Text>
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
              <Text style={[styles.optionLabel, { color: theme.text.primary }]}>Snapshots</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, getSectionTitleStyle(theme), { marginTop: 24 }]}>Appearance</Text>
        <View style={[
          styles.card,
          getCardBaseStyle({ radius: 12 }),
          getCardBorderStyle(theme),
          { backgroundColor: theme.background.surface }
        ]}>
          {themeOptions.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionRow,
                index !== themeOptions.length - 1 && [styles.optionBorder, { borderBottomColor: theme.border.secondary }]
              ]}
              onPress={() => setThemePreference(option.value)}
            >
              <View style={styles.optionLabelContainer}>
                <MaterialIcons name={option.icon} size={22} color={theme.text.primary} style={styles.optionIcon} />
                <Text style={[styles.optionLabel, { color: theme.text.primary }]}>{option.label}</Text>
              </View>
              {themePreference === option.value && (
                <MaterialIcons name="check" size={24} color={theme.button.primary.background} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
            <Text style={styles.errorText}>{error}</Text>
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
    // Base style comes from getScreenHeaderStyle helper
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  signOutIconContainer: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
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
