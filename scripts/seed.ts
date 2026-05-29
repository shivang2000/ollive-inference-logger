// Seed synthetic inference traffic so the dashboards have something to show.
// Run: DATABASE_URL=... pnpm seed [count]
import { getDb, conversations, inferenceLogs, closeDb, type NewInferenceLog } from '@ollive/db';

const PROVIDERS = [
  ['openai', 'openai/gpt-4o-mini'],
  ['openai', 'openai/gpt-4.1'],
  ['anthropic', 'anthropic/claude-3.5-sonnet'],
  ['google', 'google/gemini-2.0-flash-001'],
  ['deepseek', 'deepseek/deepseek-chat'],
] as const;

// ~80% success, ~10% error, ~10% cancelled.
const STATUSES = [
  'success',
  'success',
  'success',
  'success',
  'success',
  'success',
  'success',
  'success',
  'error',
  'cancelled',
] as const;

const ERROR_TYPES = ['http_429', 'http_500', 'timeout'] as const;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[rand(0, arr.length - 1)]!;
}

async function main() {
  const db = getDb();
  const count = Number(process.argv[2] ?? 200);
  const now = Date.now();

  const [conv] = await db.insert(conversations).values({ title: 'Seed traffic' }).returning();

  const rows: NewInferenceLog[] = [];
  for (let i = 0; i < count; i++) {
    const [provider, model] = pick(PROVIDERS);
    const status = pick(STATUSES);
    const createdAt = new Date(now - rand(0, 60 * 60 * 1000)); // within the last hour
    const ingestedAt = new Date(createdAt.getTime() + rand(20, 400)); // ingest lag

    const row: NewInferenceLog = {
      requestId: crypto.randomUUID(),
      conversationId: conv!.id,
      model,
      provider,
      status,
      createdAt,
      ingestedAt,
      inputPreview: 'seed input',
      outputPreview: status === 'error' ? null : 'seed output',
      ttftMs: status === 'error' ? null : rand(80, 600),
    };

    if (status === 'success') {
      row.latencyMs = rand(200, 2500);
      row.promptTokens = rand(20, 400);
      row.completionTokens = rand(10, 800);
      row.totalTokens = row.promptTokens + row.completionTokens;
    } else if (status === 'cancelled') {
      row.latencyMs = rand(100, 1500);
      row.completionTokens = rand(5, 200); // estimated; prompt/total stay null
      row.metadata = { tokensEstimated: true };
    } else {
      row.latencyMs = rand(50, 800);
      row.errorType = pick(ERROR_TYPES);
      row.errorMessage = 'seeded error';
    }
    rows.push(row);
  }

  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(inferenceLogs).values(rows.slice(i, i + 50));
  }

  console.log(`seeded ${rows.length} inference logs across ${PROVIDERS.length} provider/model pairs`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
