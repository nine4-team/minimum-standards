import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';
import { useSaveEdit } from './useSaveEdit';
import { VolumeFields } from '../standard-fields/VolumeFields';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SetVolumeStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const parentNavigation = flowNavigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const { editingStandardId, handleSaveEdit, saving, saveError } = useSaveEdit(parentNavigation, mainNavigation);

  const goalTotal = useStandardsBuilderStore((s) => s.goalTotal);
  const breakdownEnabled = useStandardsBuilderStore((s) => s.breakdownEnabled);
  const sessionsPerCadence = useStandardsBuilderStore((s) => s.sessionsPerCadence);
  const volumePerSession = useStandardsBuilderStore((s) => s.volumePerSession);

  const [learnMoreExpanded, setLearnMoreExpanded] = useState(false);

  const handleClose = useCallback(() => {
    parentNavigation ? parentNavigation.goBack() : mainNavigation.goBack();
  }, [parentNavigation, mainNavigation]);

  const handleBack = useCallback(() => {
    if (flowNavigation.canGoBack()) {
      flowNavigation.goBack();
    } else {
      // No SelectActivity to go back to (entered via suggestor) — close the flow
      handleClose();
    }
  }, [flowNavigation, handleClose]);

  const canSaveEdit = breakdownEnabled
    ? sessionsPerCadence !== null &&
      sessionsPerCadence > 0 &&
      volumePerSession !== null &&
      volumePerSession > 0
    : goalTotal !== null && goalTotal > 0;

  const handleNext = useCallback(() => {
    flowNavigation.navigate('SetPeriod');
  }, [flowNavigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <StepHeader
        step={1}
        totalSteps={3}
        title="Set Volume"
        onBack={handleBack}
        onClose={handleClose}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* T025: Inline Tip */}
          <View
            style={[
              styles.tipContainer,
              {
                backgroundColor: theme.background.surface,
                borderLeftColor: theme.button.primary.background,
              },
            ]}
          >
            <View style={styles.tipRow}>
              <MaterialIcons
                name="lightbulb-outline"
                size={16}
                color={theme.text.secondary}
                style={styles.tipIcon}
              />
              <Text style={[styles.tipText, { color: theme.text.secondary }]}>
                Start where you can consistently win, not at your ideal level.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setLearnMoreExpanded(!learnMoreExpanded)}
              style={styles.learnMoreButton}
            >
              <Text style={[styles.learnMoreText, { color: theme.button.primary.background }]}>
                {learnMoreExpanded ? 'Show Less' : 'Learn More'}
              </Text>
              <MaterialIcons
                name={learnMoreExpanded ? 'expand-less' : 'expand-more'}
                size={16}
                color={theme.button.primary.background}
              />
            </TouchableOpacity>
            {learnMoreExpanded && (
              <Text style={[styles.learnMoreContent, { color: theme.text.secondary }]}>
                Your Minimum Standard should be low enough that you can hit it even on your worst
                day. The goal isn't to set your ideal volume — it's to set the floor that you never
                go below. Once you build consistency at this level, you can always increase it later.
                Think of it as your "never go below this" commitment, not your aspiration.
              </Text>
            )}
          </View>

          <VolumeFields />
        </ScrollView>

        {/* Footer */}
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
          {editingStandardId ? (
            <>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  {
                    backgroundColor: canSaveEdit && !saving
                      ? theme.button.primary.background
                      : theme.button.disabled.background,
                  },
                ]}
                onPress={handleSaveEdit}
                disabled={!canSaveEdit || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.button.primary.text} />
                ) : (
                  <Text style={[styles.nextButtonText, { color: canSaveEdit ? theme.button.primary.text : theme.button.disabled.text }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
              {saveError && (
                <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
                  {saveError}
                </Text>
              )}
              <TouchableOpacity style={styles.nextLink} onPress={handleNext}>
                <Text style={[styles.nextLinkText, { color: theme.link }]}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: theme.button.primary.background }]}
              onPress={handleNext}
            >
              <Text style={[styles.nextButtonText, { color: theme.button.primary.text }]}>Next</Text>
            </TouchableOpacity>
          )}
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
  scrollContent: {
    paddingBottom: 24,
  },
  // Tip styles (T025)
  tipContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 24,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  learnMoreContent: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    paddingLeft: 24,
  },
  // Footer styles
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  nextButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  nextLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
