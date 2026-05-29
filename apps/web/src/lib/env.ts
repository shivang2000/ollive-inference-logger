// Server-side env. Read lazily so a missing key surfaces as a clear runtime error in the
// chat route rather than crashing the whole app at import time.
export const env = {
  get openrouterApiKey() {
    return process.env.OPENROUTER_API_KEY ?? '';
  },
  get ingestionUrl() {
    return process.env.INGESTION_URL ?? 'http://localhost:4000';
  },
  get defaultModel() {
    return process.env.DEFAULT_MODEL ?? 'openai/gpt-4o-mini';
  },
};

export const CONTEXT_WINDOW_SIZE = 10;
