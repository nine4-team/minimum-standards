import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_BORDER_RADIUS } from '@nine4/ui-kit';
import { StepHeader } from '../../navigation/CreateStandardFlow';
import { SuggestorFlowParamList, MainStackParamList } from '../../navigation/types';
import { useSuggestStandards } from '../../hooks/useSuggestStandards';
import { useTheme } from '../../theme/useTheme';

type FlowNav = NativeStackNavigationProp<SuggestorFlowParamList>;
type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SuggestorInputStep() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flowNavigation = useNavigation<FlowNav>();
  const mainNavigation = useNavigation<MainNav>();
  const { suggest, loading, error } = useSuggestStandards();

  const [input, setInput] = useState('');
  const trimmed = input.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  const handleSubmit = async () => {
    const result = await suggest(trimmed);
    if (result && result.suggestions.length > 0) {
      flowNavigation.navigate('SuggestorActivity', {
        suggestions: result.suggestions,
      });
    }
  };

  const handleClose = () => {
    mainNavigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StepHeader
        step={0}
        totalSteps={3}
        title="What do you want to improve?"
        onClose={handleClose}
      />

      <View style={styles.content}>
        <Text style={[styles.prompt, { color: theme.text.secondary }]}>
          Describe what you'd like to work on, and we'll suggest some standards for you.
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.input.background,
              borderColor: theme.input.border,
              color: theme.input.text,
              borderRadius: BUTTON_BORDER_RADIUS,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder='e.g. "get in better shape", "read more", "be more productive"'
          placeholderTextColor={theme.input.placeholder}
          multiline
          numberOfLines={3}
          maxLength={500}
          autoFocus
          editable={!loading}
        />

        {error ? (
          <Text style={[styles.errorText, { color: theme.status.missed }]}>{error}</Text>
        ) : null}
      </View>

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
            styles.button,
            {
              backgroundColor: canSubmit
                ? theme.button.primary.background
                : theme.button.disabled.background,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.button.primary.text} />
          ) : (
            <Text
              style={[
                styles.buttonText,
                {
                  color: canSubmit
                    ? theme.button.primary.text
                    : theme.button.disabled.text,
                },
              ]}
            >
              Suggest Activities
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  prompt: {
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
