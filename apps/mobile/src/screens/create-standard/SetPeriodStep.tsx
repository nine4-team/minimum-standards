import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useStandards, ActiveCapExceededError } from '../../hooks/useStandards';
import { ArchiveToMakeRoomSheet } from '../../components/ArchiveToMakeRoomSheet';
import { useUIPreferencesStore } from '../../stores/uiPreferencesStore';
import { useTheme } from '../../theme/useTheme';
import { trackStandardEvent } from '../../utils/analytics';
import { useSaveEdit } from './useSaveEdit';
import { PeriodFields } from '../standard-fields/PeriodFields';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SetPeriodStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const { createStandard, archiveStandard, activeStandards } = useStandards();
  const parentNavigation = flowNavigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const setPendingScrollToStandardId = useUIPreferencesStore((s) => s.setPendingScrollToStandardId);
  const { editingStandardId, handleSaveEdit, saving: savingEdit, saveError } = useSaveEdit(parentNavigation, mainNavigation);

  const generatePayload = useStandardsBuilderStore((s) => s.generatePayload);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capSheetVisible, setCapSheetVisible] = useState(false);
  const [learnMoreExpanded, setLearnMoreExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    setErrorMessage(null);

    const payload = generatePayload();
    if (!payload) {
      setErrorMessage('Please complete all fields before creating your standard.');
      return;
    }

    setSubmitting(true);
    try {
      const newStandard = await createStandard(payload);
      trackStandardEvent('standard_create', { standardName: payload.name });
      // Tell the dashboard to scroll to the newly created standard's card
      setPendingScrollToStandardId(newStandard.id);
      // Dismiss the entire CreateStandardFlow modal via the parent (MainStack) navigator.
      // The flow's unmount cleanup in CreateStandardFlow.tsx handles store reset.
      if (parentNavigation) {
        parentNavigation.goBack();
      } else {
        mainNavigation.goBack();
      }
    } catch (err) {
      if (err instanceof ActiveCapExceededError) {
        setCapSheetVisible(true);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [generatePayload, createStandard, parentNavigation, mainNavigation, setPendingScrollToStandardId]);

  const handleArchiveAndRetry = useCallback(async (standardId: string) => {
    setCapSheetVisible(false);
    const payload = generatePayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      await archiveStandard(standardId);
      const newStandard = await createStandard(payload, { bypassCap: true });
      trackStandardEvent('standard_create', { standardName: payload.name });
      setPendingScrollToStandardId(newStandard.id);
      if (parentNavigation) {
        parentNavigation.goBack();
      } else {
        mainNavigation.goBack();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [archiveStandard, createStandard, generatePayload, parentNavigation, mainNavigation, setPendingScrollToStandardId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <StepHeader
        step={2}
        totalSteps={3}
        title="Set Period"
        onBack={() => flowNavigation.goBack()}
        onClose={() => parentNavigation ? parentNavigation.goBack() : mainNavigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* T029: Inline Tip */}
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
              Focus on total volume per period — flexibility beats rigid daily targets.
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
              The Minimum Standards methodology focuses on total volume over a period rather than
              rigid daily requirements. A weekly target of "run 3 times" is more sustainable than
              "run every Monday, Wednesday, Friday" because life is unpredictable. Choose the longest
              period you're comfortable with — weekly is usually the sweet spot for most people. It
              gives enough flexibility for bad days while maintaining accountability.
            </Text>
          )}
        </View>

        <PeriodFields />
      </ScrollView>

      {/* Error message */}
      {(errorMessage || saveError) && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
            {errorMessage || saveError}
          </Text>
        </View>
      )}

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
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: (editingStandardId ? savingEdit : submitting)
                ? theme.button.disabled.background
                : theme.button.primary.background,
            },
          ]}
          onPress={editingStandardId ? handleSaveEdit : handleSubmit}
          disabled={editingStandardId ? savingEdit : submitting}
          activeOpacity={0.7}
        >
          {(editingStandardId ? savingEdit : submitting) ? (
            <ActivityIndicator size="small" color={theme.button.primary.text} />
          ) : (
            <Text style={[styles.submitButtonText, { color: theme.button.primary.text }]}>
              {editingStandardId ? 'Save' : 'Create Standard'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <ArchiveToMakeRoomSheet
        visible={capSheetVisible}
        activeStandards={activeStandards}
        onArchive={handleArchiveAndRetry}
        onRequestClose={() => setCapSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Tip styles (T029)
  tipContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
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
  // Error
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    padding: 16,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
