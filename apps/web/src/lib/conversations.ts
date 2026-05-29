import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  getDb,
  conversations,
  messages,
  inferenceLogs,
  type Conversation,
  type Message,
} from '@ollive/db';
import type { ChatMessage, ConversationStatus, MessageRole } from '@ollive/shared';
import { CONTEXT_WINDOW_SIZE } from './env';

export async function listConversations(): Promise<Conversation[]> {
  const db = getDb();
  return db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .limit(100);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = getDb();
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return row;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export async function createConversation(title?: string): Promise<Conversation> {
  const db = getDb();
  const [row] = await db
    .insert(conversations)
    .values({ title: title ?? null })
    .returning();
  return row!;
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  requestId?: string,
  tokenCount?: number | null,
): Promise<Message> {
  const db = getDb();
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role, content, requestId: requestId ?? null, tokenCount: tokenCount ?? null })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return row!;
}

export async function setConversationStatus(
  id: string,
  status: ConversationStatus,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ status, updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

export async function setConversationTitleIfEmpty(id: string, title: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ title })
    .where(and(eq(conversations.id, id), isNull(conversations.title)));
}

/** Best-effort backfill: link the inference log for this turn to the assistant message. */
export async function linkLogToMessage(requestId: string, messageId: string): Promise<void> {
  const db = getDb();
  await db
    .update(inferenceLogs)
    .set({ messageId })
    .where(eq(inferenceLogs.requestId, requestId));
}

/** Last N messages of a conversation, oldest→newest, mapped for the SDK. */
export async function contextWindow(
  conversationId: string,
  limit = CONTEXT_WINDOW_SIZE,
): Promise<ChatMessage[]> {
  const db = getDb();
  const recent = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return recent
    .reverse()
    .map((m) => ({ role: m.role as MessageRole, content: m.content }));
}
