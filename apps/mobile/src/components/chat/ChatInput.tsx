import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  loading,
  placeholder = 'Type your goal...',
}: ChatInputProps) {
  const theme = useTheme();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled && !loading;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={[styles.container, { borderTopColor: theme.border.primary }]}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.background.chrome,
            color: theme.text.primary,
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.tertiary}
        multiline
        maxLength={500}
        editable={!disabled && !loading}
        onSubmitEditing={handleSend}
        blurOnSubmit
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: canSend
              ? theme.button.primary.background
              : theme.background.chrome,
          },
        ]}
        onPress={handleSend}
        disabled={!canSend}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.button.primary.text} />
        ) : (
          <MaterialIcons
            name="arrow-upward"
            size={20}
            color={canSend ? theme.button.primary.text : theme.text.tertiary}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
