import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { MainStackParamList } from '../navigation/types';
import { useStandardsBuilderStore } from '../stores/standardsBuilderStore';
import { useTheme } from '../theme/useTheme';
import { useSaveEdit } from './create-standard/useSaveEdit';
import { NameUnitNotesFields } from './standard-fields/NameUnitNotesFields';
import { VolumeFields } from './standard-fields/VolumeFields';
import { PeriodFields } from './standard-fields/PeriodFields';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function EditStandardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const resetBuilder = useStandardsBuilderStore((s) => s.reset);
  const { handleSaveEdit, saving, saveError } = useSaveEdit(undefined, navigation);

  const handleClose = useCallback(() => {
    resetBuilder();
    navigation.goBack();
  }, [resetBuilder, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: theme.border.primary }]}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Edit Standard</Text>
        <TouchableOpacity onPress={handleClose} style={styles.iconButton} accessibilityLabel="Close">
          <MaterialIcons name="close" size={24} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sectionHeader, { color: theme.text.tertiary }]}>Basics</Text>
          <NameUnitNotesFields />

          <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced, { color: theme.text.tertiary }]}>
            Volume
          </Text>
          <VolumeFields />

          <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced, { color: theme.text.tertiary }]}>
            Period
          </Text>
          <PeriodFields />
        </ScrollView>

        {saveError && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
              {saveError}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background.chrome,
              borderTopColor: theme.border.primary,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: saving
                  ? theme.button.disabled.background
                  : theme.button.primary.background,
              },
            ]}
            onPress={handleSaveEdit}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.button.primary.text} />
            ) : (
              <Text style={[styles.saveButtonText, { color: theme.button.primary.text }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeaderSpaced: {
    marginTop: 28,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    padding: 16,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
