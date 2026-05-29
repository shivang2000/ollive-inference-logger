import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const conversationStatus = pgEnum('conversation_status', [
  'active',
  'cancelled',
  'archived',
]);
export const messageRole = pgEnum('message_role', ['user', 'assistant', 'system']);
export const inferenceStatus = pgEnum('inference_status', ['success', 'error', 'cancelled']);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  status: conversationStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    // Correlation key: stamped by the web server, shared with the inference log for this turn.
    requestId: uuid('request_id'),
    role: messageRole('role').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
    index('messages_request_idx').on(t.requestId),
  ],
);

export const inferenceLogs = pgTable(
  'inference_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // UNIQUE → at-least-once dedup AND the join key across the async boundary.
    requestId: uuid('request_id').notNull().unique(),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    status: inferenceStatus('status').notNull(),
    latencyMs: integer('latency_ms'),
    ttftMs: integer('ttft_ms'),
    // Token columns nullable: null (never 0) on error/cancel so dashboard sums stay honest.
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    inputPreview: text('input_preview'),
    outputPreview: text('output_preview'),
    errorType: text('error_type'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    // Event time (when the call happened) vs processing time (when we stored it).
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('logs_created_idx').on(t.createdAt),
    index('logs_provider_created_idx').on(t.provider, t.createdAt),
    index('logs_status_created_idx').on(t.status, t.createdAt),
    index('logs_conversation_idx').on(t.conversationId),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type InferenceLog = typeof inferenceLogs.$inferSelect;
export type NewInferenceLog = typeof inferenceLogs.$inferInsert;
