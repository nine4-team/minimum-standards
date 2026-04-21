import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/useTheme';
import { MainStackParamList } from '../../navigation/types';
import { useStandardsBuilderStore } from '../../stores/standardsBuilderStore';
import { useSuggestorChat } from '../../hooks/useSuggestorChat';
import { ChatBubble } from '../../components/chat/ChatBubble';
import { ChipRow } from '../../components/chat/ChipRow';
import { ChatInput } from '../../components/chat/ChatInput';
import { SuggestionCard } from '../../components/chat/SuggestionCard';
import { SuggestorChip } from '../../components/SuggestorChip';
import type { ChatMessage, StandardSuggestion } from '../../types/suggestor';

type MainNav = NativeStackNavigationProp<MainStackParamList>;

export function SuggestorChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MainNav>();
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    loading,
    error,
    phase,
    setPhase,
    suggestions,
    sendMessage,
    selectActivity,
  } = useSuggestorChat();

  const [selectedActivity, setSelectedActivity] = useState<StandardSuggestion | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, phase]);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleActivitySelect = (suggestion: StandardSuggestion) => {
    setSelectedActivity(suggestion);
    selectActivity(suggestion);
    // If only one unit, auto-select and finish
    if (suggestion.units.length === 1) {
      setSelectedUnit(suggestion.units[0]);
      handleFinalize(suggestion.name, suggestion.units[0]);
    }
  };

  const handleUnitSelect = (unit: string) => {
    setSelectedUnit(unit);
    if (selectedActivity) {
      handleFinalize(selectedActivity.name, unit);
    }
  };

  const handleFinalize = (activityName: string, unit: string) => {
    const store = useStandardsBuilderStore.getState();
    store.reset();
    store.setName(activityName);
    store.setUnit(unit);

    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          {
            name: 'CreateStandardFlow',
            params: { initialRoute: 'SetVolume' },
          },
        ],
      })
    );
  };

  const handleChipPress = (chip: string) => {
    sendMessage(chip);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return (
      <View>
        <ChatBubble text={item.text} sender={item.role === 'user' ? 'user' : 'assistant'} />
        {item.chips && item.chips.length > 0 && phase === 'chatting' && (
          <ChipRow
            chips={item.chips}
            onSelect={handleChipPress}
            disabled={loading}
          />
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (phase === 'selecting_activity' && suggestions) {
      return (
        <View style={styles.selectionContainer}>
          <Text style={[styles.selectionLabel, { color: theme.text.secondary }]}>
            Pick an activity:
          </Text>
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.name}
              suggestion={s}
              isSelected={selectedActivity?.name === s.name}
              onPress={() => handleActivitySelect(s)}
            />
          ))}
        </View>
      );
    }

    if (phase === 'selecting_unit' && selectedActivity) {
      return (
        <View style={styles.selectionContainer}>
          <Text style={[styles.selectionLabel, { color: theme.text.secondary }]}>
            Pick a unit for {selectedActivity.name}:
          </Text>
          <View style={styles.unitChips}>
            {selectedActivity.units.map((u) => (
              <SuggestorChip
                key={u}
                label={u}
                isSelected={selectedUnit === u}
                onPress={() => handleUnitSelect(u)}
              />
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleClose} hitSlop={8}>
          <MaterialIcons name="close" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          AI Suggestions
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                What do you want to improve?
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
                Describe your goal and I'll suggest activities to track.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
      />

      {/* Error */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.background.chrome }]}>
          <Text style={[styles.errorText, { color: theme.button.destructive.text }]}>{error}</Text>
        </View>
      )}

      {/* Input (only visible during chat phase) */}
      {phase === 'chatting' && (
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput
            onSend={sendMessage}
            loading={loading}
            disabled={loading}
            placeholder={
              messages.length === 0
                ? "e.g. 'get in better shape', 'read more'..."
                : 'Type your answer...'
            }
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  messageList: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  selectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  selectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  unitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
