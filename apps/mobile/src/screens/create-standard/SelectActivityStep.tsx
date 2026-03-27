import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { CreateStandardFlowParamList, MainStackParamList } from '../../navigation/types';
import { useCategories } from '../../hooks/useCategories';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useTheme } from '../../theme/useTheme';

type FlowNav = NativeStackNavigationProp<CreateStandardFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SelectActivityStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();

  const { orderedCategories } = useCategories();

  const standardName = useStandardsBuilderStore((s) => s.name);
  const setStandardName = useStandardsBuilderStore((s) => s.setName);
  const standardUnit = useStandardsBuilderStore((s) => s.unit);
  const setStandardUnit = useStandardsBuilderStore((s) => s.setUnit);
  const standardNotes = useStandardsBuilderStore((s) => s.notes);
  const setStandardNotes = useStandardsBuilderStore((s) => s.setNotes);
  const standardCategoryId = useStandardsBuilderStore((s) => s.categoryId);
  const setStandardCategoryId = useStandardsBuilderStore((s) => s.setCategoryId);

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

        {/* Name field */}
        <View style={styles.fieldSection}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Name</Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
                borderRadius: BUTTON_BORDER_RADIUS,
              },
            ]}
            value={standardName}
            onChangeText={setStandardName}
            placeholder="e.g. Running, Reading, Cold Calls"
            placeholderTextColor={theme.input.placeholder}
            maxLength={120}
            autoFocus
          />
        </View>

        {/* Unit field */}
        <View style={styles.fieldSection}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Unit</Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
                borderRadius: BUTTON_BORDER_RADIUS,
              },
            ]}
            value={standardUnit}
            onChangeText={setStandardUnit}
            placeholder="e.g. minutes, miles, pages, calls"
            placeholderTextColor={theme.input.placeholder}
            autoCorrect={false}
          />
        </View>

        {/* Category picker */}
        <View style={styles.fieldSection}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>
            Category (Optional)
          </Text>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  borderColor: standardCategoryId === null
                    ? theme.button.primary.background
                    : theme.border.primary,
                  backgroundColor: standardCategoryId === null
                    ? theme.background.surface
                    : theme.background.chrome,
                },
              ]}
              onPress={() => setStandardCategoryId(null)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  {
                    color: standardCategoryId === null ? theme.text.primary : theme.text.secondary,
                    fontWeight: standardCategoryId === null ? '600' : '400',
                  },
                ]}
              >
                None
              </Text>
            </TouchableOpacity>
            {orderedCategories.map((cat) => {
              const isActive = standardCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    {
                      borderColor: isActive
                        ? theme.button.primary.background
                        : theme.border.primary,
                      backgroundColor: isActive
                        ? theme.background.surface
                        : theme.background.chrome,
                    },
                  ]}
                  onPress={() => setStandardCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: isActive ? theme.text.primary : theme.text.secondary,
                        fontWeight: isActive ? '600' : '400',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes field */}
        <View style={styles.fieldSection}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Notes (Optional)</Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.input.background,
                borderColor: theme.input.border,
                color: theme.input.text,
                borderRadius: BUTTON_BORDER_RADIUS,
              },
            ]}
            value={standardNotes ?? ''}
            onChangeText={(text) => setStandardNotes(text || null)}
            placeholder="Add notes about this standard..."
            placeholderTextColor={theme.input.placeholder}
            multiline
            numberOfLines={3}
            maxLength={1000}
          />
        </View>
      </ScrollView>

      {/* Next Button */}
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
  // Field styles
  fieldSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderRadius: 20,
  },
  categoryChipText: {
    fontSize: 14,
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
});
