import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ChatBubbleProps {
  text: string;
  sender: 'user' | 'assistant';
}

export function ChatBubble({ text, sender }: ChatBubbleProps) {
  const theme = useTheme();
  const isUser = sender === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser
              ? theme.button.primary.background
              : theme.background.chrome,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isUser
                ? theme.button.primary.text
                : theme.text.primary,
            },
          ]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
});
