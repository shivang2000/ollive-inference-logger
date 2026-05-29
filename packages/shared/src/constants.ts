// Cross-service constants. Kept here so the SDK, producer, and worker never drift.

/** Redis Stream that carries inference logs from producer → worker. */
export const INFERENCE_STREAM = 'inference:logs';

/** Consumer group for ingestion workers (enables at-least-once + replay). */
export const INGEST_CONSUMER_GROUP = 'ingest-workers';

/** Max characters stored for input/output previews (truncated by the SDK). */
export const PREVIEW_MAX_CHARS = 500;
