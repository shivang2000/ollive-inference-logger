// Shared domain types — the single vocabulary used across SDK, ingestion, and web.

export type MessageRole = 'user' | 'assistant' | 'system';

/** Outcome of a single inference call. Drives dashboard semantics. */
export type InferenceStatus = 'success' | 'error' | 'cancelled';

export type ConversationStatus = 'active' | 'cancelled' | 'archived';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}
