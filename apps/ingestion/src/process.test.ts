import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, closeDb, inferenceLogs, conversations, type Db } from '@ollive/db';
import type { InferenceLogInput } from '@ollive/shared';
import { upsertLog } from './process.js';

// Integration test — needs a Postgres reachable at DATABASE_URL (CI provides one; locally,
// run with DATABASE_URL=postgres://ollive:ollive@localhost:5433/ollive). Skips cleanly otherwise.
const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('upsertLog (integration)', () => {
  let db: Db;
  let convId: string;
  const created: string[] = [];

  function log(over: Partial<InferenceLogInput> = {}): InferenceLogInput {
    const requestId = crypto.randomUUID();
    created.push(requestId);
    return {
      requestId,
      model: 'openai/gpt-4o-mini',
      provider: 'openai',
      status: 'success',
      createdAt: new Date().toISOString(),
      ...over,
    };
  }

  beforeAll(async () => {
    db = getDb();
    const [conv] = await db.insert(conversations).values({}).returning();
    convId = conv!.id;
  });

  afterEach(async () => {
    for (const id of created.splice(0)) {
      await db.delete(inferenceLogs).where(eq(inferenceLogs.requestId, id));
    }
  });

  afterAll(async () => {
    await db.delete(conversations).where(eq(conversations.id, convId));
    await closeDb();
  });

  it('inserts a row', async () => {
    const l = log();
    await upsertLog(db, l);
    const rows = await db.select().from(inferenceLogs).where(eq(inferenceLogs.requestId, l.requestId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe('openai');
    expect(rows[0]!.ingestedAt).toBeInstanceOf(Date);
  });

  it('is idempotent on a duplicate request_id (no duplicate rows)', async () => {
    const l = log();
    await upsertLog(db, l);
    await upsertLog(db, l);
    const rows = await db.select().from(inferenceLogs).where(eq(inferenceLogs.requestId, l.requestId));
    expect(rows).toHaveLength(1);
  });

  it('redacts PII in stored previews', async () => {
    const l = log({
      inputPreview: 'mail me at jane@example.com',
      outputPreview: 'card 4242 4242 4242 4242',
    });
    await upsertLog(db, l);
    const [row] = await db.select().from(inferenceLogs).where(eq(inferenceLogs.requestId, l.requestId));
    expect(row!.inputPreview).toContain('[REDACTED_EMAIL]');
    expect(row!.outputPreview).toContain('[REDACTED_CARD]');
  });

  it('backfills a previously-null conversation_id via COALESCE, without duplicating', async () => {
    const l = log({ conversationId: null });
    await upsertLog(db, l);
    // Re-process the same request_id carrying the conversation id (enrichment / redelivery).
    await upsertLog(db, { ...l, conversationId: convId });
    const rows = await db.select().from(inferenceLogs).where(eq(inferenceLogs.requestId, l.requestId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.conversationId).toBe(convId);
  });
});
