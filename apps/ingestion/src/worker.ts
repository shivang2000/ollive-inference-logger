import { pathToFileURL } from 'node:url';
import type Redis from 'ioredis';
import { getDb, type Db } from '@ollive/db';
import { inferenceLogSchema, INFERENCE_STREAM, INGEST_CONSUMER_GROUP } from '@ollive/shared';
import { createRedis } from './redis.js';
import { upsertLog } from './process.js';

const CONSUMER = `worker-${process.pid}`;
// Reclaim entries that have been pending (delivered, un-ACKed) longer than this — i.e. from a
// crashed consumer. Short by default so a restarted worker recovers quickly.
const RECLAIM_IDLE_MS = Number(process.env.RECLAIM_IDLE_MS ?? 30_000);

type StreamEntry = [id: string, fields: string[]];

export async function ensureGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup('CREATE', INFERENCE_STREAM, INGEST_CONSUMER_GROUP, '$', 'MKSTREAM');
  } catch (err) {
    // BUSYGROUP = group already exists; anything else is fatal.
    if (!(err instanceof Error && err.message.includes('BUSYGROUP'))) throw err;
  }
}

function extractData(fields: string[]): string | null {
  const i = fields.indexOf('data');
  return i >= 0 ? (fields[i + 1] ?? null) : null;
}

/** Parse, validate, store, ACK. Bad payloads are ACKed (not retried) to avoid poison-pills. */
export async function processEntry(
  db: Db,
  redis: Redis,
  id: string,
  fields: string[],
): Promise<void> {
  const raw = extractData(fields);
  if (raw) {
    try {
      const parsed = inferenceLogSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        await upsertLog(db, parsed.data);
      } else {
        console.warn(`[worker] invalid log ${id}; acking to avoid poison-pill`);
      }
    } catch (err) {
      console.warn(`[worker] unparseable log ${id}; acking`, err);
    }
  }
  await redis.xack(INFERENCE_STREAM, INGEST_CONSUMER_GROUP, id);
}

async function readNew(redis: Redis): Promise<StreamEntry[]> {
  const res = (await redis.xreadgroup(
    'GROUP',
    INGEST_CONSUMER_GROUP,
    CONSUMER,
    'COUNT',
    20,
    'BLOCK',
    5000,
    'STREAMS',
    INFERENCE_STREAM,
    '>',
  )) as Array<[string, StreamEntry[]]> | null;
  return res?.[0]?.[1] ?? [];
}

async function reclaimStale(redis: Redis): Promise<StreamEntry[]> {
  const res = (await redis.xautoclaim(
    INFERENCE_STREAM,
    INGEST_CONSUMER_GROUP,
    CONSUMER,
    RECLAIM_IDLE_MS,
    '0',
    'COUNT',
    20,
  )) as [string, StreamEntry[], string[]] | null;
  return res?.[1] ?? [];
}

async function main(): Promise<void> {
  const redis = createRedis();
  const db = getDb();
  await ensureGroup(redis);
  console.log(`[worker] ${CONSUMER} consuming ${INFERENCE_STREAM}`);

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      for (const [id, fields] of await reclaimStale(redis)) {
        await processEntry(db, redis, id, fields);
      }
      for (const [id, fields] of await readNew(redis)) {
        await processEntry(db, redis, id, fields);
      }
    } catch (err) {
      console.error('[worker] loop error', err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await redis.quit();
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error('[worker] fatal', err);
    process.exit(1);
  });
}
