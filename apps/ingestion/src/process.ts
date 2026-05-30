import { and, eq, sql } from 'drizzle-orm';
import { inferenceLogs, messages, type Db, type NewInferenceLog } from '@ollive/db';
import { redactIfEnabled, type InferenceLogInput } from '@ollive/shared';

/** Map a validated wire payload to a DB row, redacting previews if enabled. */
export function toRow(log: InferenceLogInput): NewInferenceLog {
  return {
    requestId: log.requestId,
    conversationId: log.conversationId ?? null,
    messageId: log.messageId ?? null,
    sessionId: log.sessionId ?? null,
    model: log.model,
    provider: log.provider,
    status: log.status,
    latencyMs: log.latencyMs ?? null,
    ttftMs: log.ttftMs ?? null,
    promptTokens: log.promptTokens ?? null,
    completionTokens: log.completionTokens ?? null,
    totalTokens: log.totalTokens ?? null,
    inputPreview: log.inputPreview ? redactIfEnabled(log.inputPreview) : null,
    outputPreview: log.outputPreview ? redactIfEnabled(log.outputPreview) : null,
    errorType: log.errorType ?? null,
    errorMessage: log.errorMessage ?? null,
    metadata: log.metadata ?? null,
    createdAt: new Date(log.createdAt),
  };
}

/**
 * Idempotent upsert keyed on request_id. At-least-once delivery means we may see the same
 * request_id twice; ON CONFLICT keeps the existing row and only backfills conversation_id /
 * message_id when they were previously null (so a later enrichment event isn't lost).
 */
export async function upsertLog(db: Db, log: InferenceLogInput): Promise<void> {
  const row = toRow(log);

  // Resolve message_id by the shared request_id. The web server persists the assistant message
  // synchronously, so by the time this async log is processed the row usually exists — a reliable
  // way to link log → message without a racy web-side UPDATE.
  if (!row.messageId) {
    const [m] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.requestId, log.requestId), eq(messages.role, 'assistant')))
      .limit(1);
    if (m) row.messageId = m.id;
  }

  await db
    .insert(inferenceLogs)
    .values(row)
    .onConflictDoUpdate({
      target: inferenceLogs.requestId,
      set: {
        conversationId: sql`coalesce(${inferenceLogs.conversationId}, excluded.conversation_id)`,
        messageId: sql`coalesce(${inferenceLogs.messageId}, excluded.message_id)`,
      },
    });
}
