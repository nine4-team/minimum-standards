import { useState, useCallback, useRef } from 'react';
import { callFunction } from '../services/cloudFunctions';
import type {
  ChatMessage,
  AIResponse,
  StandardSuggestion,
} from '../types/suggestor';

export type SuggestorPhase =
  | 'chatting'
  | 'selecting_activity'
  | 'selecting_unit'
  | 'done';

let nextId = 0;
function makeId(): string {
  return `msg_${Date.now()}_${nextId++}`;
}

export function useSuggestorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SuggestorPhase>('chatting');
  const [suggestions, setSuggestions] = useState<StandardSuggestion[] | null>(null);
  const clarifyCount = useRef(0);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: makeId(), role: 'user', text: trimmed };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      // Build the API message history from existing messages + this one
      const allMessages = [...messages, userMsg];
      const apiMessages = allMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      // If we've hit 3 clarifications, force suggest mode
      if (clarifyCount.current >= 5) {
        apiMessages.push({
          role: 'user' as const,
          content: 'Please provide your suggestions now.',
        });
      }

      const result = await callFunction<AIResponse>('suggestStandardsChat', {
        messages: apiMessages,
      });

      if (result.type === 'clarify') {
        clarifyCount.current += 1;
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: result.question,
          chips: result.chips,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else if (result.type === 'suggest') {
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: "Here's what I'd suggest:",
          suggestions: result.suggestions,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setSuggestions(result.suggestions);
        setPhase('selecting_activity');
      }
    } catch (err: any) {
      const code = err?.code;
      if (code === 'functions/resource-exhausted') {
        setError('Daily limit reached. Try again tomorrow.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const selectActivity = useCallback((suggestion: StandardSuggestion) => {
    if (suggestion.units.length === 1) {
      setPhase('done');
    } else {
      setPhase('selecting_unit');
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setLoading(false);
    setError(null);
    setPhase('chatting');
    setSuggestions(null);
    clarifyCount.current = 0;
  }, []);

  return {
    messages,
    loading,
    error,
    phase,
    setPhase,
    suggestions,
    sendMessage,
    selectActivity,
    reset,
  };
}
