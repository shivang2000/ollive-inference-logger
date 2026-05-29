# Architecture Notes

## System diagram

```mermaid
flowchart LR
  U[User] -->|chat| WEB[Next.js web<br/>chat UI + dashboards]
  WEB -->|POST /api/chat SSE| SRV[Next.js server route]
  SRV -->|persist user+assistant msgs| PG[(Postgres)]
  SRV -->|olliveSDK.chat requestId| SDK[@ollive/sdk]
  SDK -->|stream tokens| WEB
  SDK -->|OpenRouter call| OR[(OpenRouter<br/>multi-provider)]
  SDK -.->|buffered, non-blocking<br/>POST /v1/logs| ING[Fastify ingestion API]
  ING -->|XADD| RS{{Redis Stream<br/>inference:logs}}
  RS -->|XREADGROUP consumer group| WK[Worker]
  WK -->|validate → extract → redact → idempotent upsert| PG
  WEB -->|read aggregates CQRS-lite| PG
```

## Ingestion flow

1. **Capture (SDK).** `@ollive/sdk` wraps the OpenRouter call. It records model, provider,
   latency, time-to-first-token, token usage, status, timestamps, session/conversation id, and
   truncated input/output previews, keyed by a caller-supplied `request_id`.
2. **Ship (SDK → API).** Logs are buffered and flushed on an interval (~1s) or batch threshold,
   then POSTed in batches to the ingestion API. Shipping is non-blocking and retried with
   exponential backoff + jitter; on persistent failure a log is dropped with a warning — never
   throwing into the chat path.
3. **Accept (producer).** The Fastify `POST /v1/logs` endpoint validates each payload with zod,
   `XADD`s it to the `inference:logs` Redis Stream, and returns `202` immediately. It does no DB
   work, so it stays cheap under load.
4. **Process (worker).** A worker in the `ingest-workers` consumer group `XREADGROUP`s entries,
   extracts metadata, redacts PII from previews, upserts into `inference_logs` (idempotent on
   `request_id`), and `XACK`s.
5. **Read (dashboards).** Next.js server components query aggregates directly from Postgres.

## Logging strategy

- **Decoupled from the request path.** Chat messages are persisted synchronously (durable
  user-facing state); inference logs travel the async pipeline. The two are correlated by
  `request_id`, minted once by the web server and stamped on both.
- **Honest token accounting.** OpenRouter delivers authoritative usage only in the final SSE
  chunk. On success → exact tokens; on cancel (no final chunk) → a client-side **estimate**,
  flagged `tokensEstimated`; on error → null. Token columns are nullable, never `0`, so dashboard
  sums and percentiles stay correct (latency percentiles are computed over successful calls only).
- **Previews, not payloads.** Only truncated, PII-redacted previews of input/output are stored —
  enough to debug, bounded in size, scrubbed of emails/keys/cards/phones/SSNs.
- **Two clocks.** `created_at` (event time, from the SDK) and `ingested_at` (processing time, set
  by the worker) are stored separately; their difference is surfaced as pipeline lag.

## Scaling considerations

- **Producer** is stateless and horizontally scalable behind a load balancer; it only validates +
  `XADD`.
- **Workers** scale horizontally as one consumer group — Redis partitions pending entries across
  consumers, so adding workers increases throughput without duplicate processing.
- **Backpressure** lives in the stream: if workers fall behind, the stream grows (observable via
  `XLEN` / consumer-group lag) rather than dropping data or stalling the producer.
- **Datastore.** Postgres with targeted indexes handles assignment scale. The growth path:
  read replicas for the dashboard (CQRS read side), then a column store (Clickhouse/Timescale)
  with periodic rollups for high-cardinality, high-volume analytics. The schema's event/processing
  time split and `request_id` key port cleanly to that model.
- **SDK** batches and flushes asynchronously, so per-call overhead is a buffer append; shipping
  cost amortizes across a batch.

## Failure-handling assumptions

- **At-least-once, not exactly-once.** Redis Streams + consumer groups guarantee at-least-once
  delivery. Idempotency is enforced at the database: `inference_logs.request_id` is UNIQUE and the
  worker upserts with `ON CONFLICT (request_id) DO UPDATE … COALESCE(...)`, so re-delivery produces
  no duplicate rows and a later enrichment event backfills previously-null fields instead of being
  dropped.
- **Crashed workers recover.** Entries delivered but not `XACK`ed before a crash become pending;
  a restarted/peer worker reclaims them via `XAUTOCLAIM` after a min-idle threshold and reprocesses
  them (idempotently).
- **Poison pills don't stall the group.** A payload that fails validation or JSON parsing is
  logged and `XACK`ed rather than retried forever. (A dead-letter stream is the next improvement.)
- **Telemetry failure is isolated.** If the ingestion API or Redis is down, the SDK retries then
  drops — the user's chat is unaffected. Logs for that window are lost, which is the accepted
  trade for never degrading the product path.
- **Ordering.** Per-stream ordering is preserved on ingest; the pipeline does not assume global
  ordering across shards. Dashboards bucket by `created_at`, so out-of-order processing doesn't
  distort time series.

## Why dashboards read Postgres directly (CQRS-lite)

The ingestion service owns writes; the web app owns reads. Dashboards query Postgres directly from
server components rather than through the ingestion service — there's no need for a separate query
API at this scale, and it keeps the write path focused. Consistency is read-your-writes-after-
ingest-lag; that lag is itself a dashboard panel (`ingested_at − created_at`). The scale path is
read replicas, then a dedicated analytics store, without changing the write pipeline.
