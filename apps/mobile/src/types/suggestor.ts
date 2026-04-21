export interface StandardSuggestion {
  name: string;
  units: string[];
}

export interface ClarifyResponse {
  type: 'clarify';
  question: string;
  chips?: string[];
}

export interface SuggestResponse {
  type: 'suggest';
  suggestions: StandardSuggestion[];
}

export type AIResponse = ClarifyResponse | SuggestResponse;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: string[];
  suggestions?: StandardSuggestion[];
}
