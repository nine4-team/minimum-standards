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
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';
import { useSaveEdit } from './useSaveEdit';
import { NameUnitNotesFields } from '../standard-fields/NameUnitNotesFields';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SelectActivityStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const parentNavigation = flowNavigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const { editingStandardId, handleSaveEdit, saving, saveError } = useSaveEdit(parentNavigation, mainNavigation);

  const standardName = useStandardsBuilderStore((s) => s.name);
  const standardUnit = useStandardsBuilderStore((s) => s.unit);
  const resetBuilder = useStandardsBuilderStore((s) => s.reset);

  const [learnMoreExpanded, setLearnMoreExpanded] = useState(false);

  const handleClose = useCallback(() => {
    resetBuilder();
    mainNavigation.goBack();
  }, [resetBuilder, mainNavigation]);

  const canProceed = standardName.trim().length > 0 && standardUnit.trim().length > 0;

  const handleNext = useCallback(() => {
    if (canProceed) {
      flowNavigation.navigate('SetVolume');
    }
  }, [canProceed, flowNavigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background.chrome }]}>
      <StepHeader
        step={0}
        totalSteps={3}
        title="Name Your Standard"
        onClose={handleClose}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Inline Tip */}
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
              Pick the activity that, if you did enough of it, would make success almost
              guaranteed.
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
              A Minimum Standard is the smallest amount of an activity you can commit to doing
              consistently. The key insight: choose the activity that is most directly connected to
              your goal. If your goal is to get fit, what single activity, done consistently, would
              make that almost inevitable? Focus on the "lead domino" -- the one action that makes
              everything else easier or unnecessary.
            </Text>
          )}
        </View>

        {/* Suggestor entry point — disabled, feature cut for now
        <TouchableOpacity
          style={styles.suggestorLink}
          onPress={() => {
            mainNavigation.replace('SuggestorFlow');
          }}
        >
          <MaterialIcons
            name="auto-awesome"
            size={16}
            color={theme.button.primary.background}
          />
          <Text style={[styles.suggestorLinkText, { color: theme.button.primary.background }]}>
            Not sure what to track? Help me decide
          </Text>
        </TouchableOpacity>
        */}

        <NameUnitNotesFields autoFocusName />
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
                  backgroundColor: canProceed && !saving
                    ? theme.button.primary.background
                    : theme.button.disabled.background,
                },
              ]}
              onPress={handleSaveEdit}
              disabled={!canProceed || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.button.primary.text} />
              ) : (
                <Text
                  style={[styles.nextButtonText, { color: canProceed ? theme.button.primary.text : theme.button.disabled.text }]}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
            {saveError && (
              <Text style={[styles.errorText, { color: theme.button.primary.background }]}>
                {saveError}
              </Text>
            )}
            <TouchableOpacity
              style={styles.nextLink}
              onPress={handleNext}
              disabled={!canProceed}
            >
              <Text style={[styles.nextLinkText, { color: canProceed ? theme.link : theme.text.secondary }]}>
                Next →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor: canProceed
                  ? theme.button.primary.background
                  : theme.button.disabled.background,
              },
            ]}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text
              style={[
                styles.nextButtonText,
                {
                  color: canProceed
                    ? theme.button.primary.text
                    : theme.button.disabled.text,
                },
              ]}
            >
              Next
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
  // Tip styles
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
  // Suggestor link
  suggestorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
  },
  suggestorLinkText: {
    fontSize: 14,
    fontWeight: '600',
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
