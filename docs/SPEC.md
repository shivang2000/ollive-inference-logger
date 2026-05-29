# Ollive Inference Logger — Technical Spec

Canonical design reference. The phased build prompts in [`/prompts`](../prompts) point here.

## Goal

A lightweight LLM **inference logging + ingestion** system: a streaming chatbot, an SDK that
captures inference metadata, an event-based ingestion pipeline, Postgres storage, and
observability dashboards. Scope = all assignment bonuses (multi-provider, streaming,
dashboards, Docker Compose one-command, event-based architecture, PII redaction, k8s-lite).

## Architecture

```
User → Next.js web (chat UI + dashboards)
       │  POST /api/chat (SSE)
       ▼
   Next.js server route ── persist messages ──▶ Postgres
       │  olliveSDK.chat({ requestId })
       ▼
   @ollive/sdk ──stream tokens──▶ web
       │  OpenRouter call (multi-provider)
       │  batched, non-blocking  POST /v1/logs
       ▼
   Fastify ingestion API ──XADD──▶ Redis Stream (inference:logs)
                                        │ XREADGROUP (consumer group)
                                        ▼
                                   Ingestion worker
                                   validate → extract → PII-redact → idempotent upsert
                                        │
                                        ▼
                                     Postgres ◀── dashboards read (CQRS-lite)
```

**Two decoupled write paths:** (1) chat messages persisted **synchronously** by the web server
for correctness; (2) inference logs shipped **asynchronously** by the SDK → Fastify producer
ACKs fast → Redis Stream → worker. At-least-once delivery + idempotency on `request_id`.

## Correlation across the async boundary (critical)

The **web server generates `request_id`** (uuid) per turn and passes it BOTH into
`olliveSDK.chat({ requestId })` AND onto the `messages` row(s) it persists. The SDK never needs
the assistant `message_id` (minted later, by a different process, possibly after the log already
flushed — or never, on cancel). `request_id` is the join key end-to-end. The worker backfills
`inference_logs.message_id` via `ON CONFLICT (request_id) DO UPDATE SET message_id = COALESCE(...)`
— never `DO NOTHING` (that would drop the enrichment).

## Components

### `apps/web` — chatbot + dashboards (Next.js 15 App Router)
- Chat UI: message list, composer, model/provider picker, conversation sidebar.
- `POST /api/chat`: generate `request_id` → load short context window (last ~10 msgs or token
  budget) → persist user message (with `request_id`) → `olliveSDK.chat({ stream:true, requestId })`
  → return SSE → persist assistant message (same `request_id`) on completion.
- Streaming via SSE; client consumes with `fetch` + `ReadableStream`.
- **Cancel**: `AbortController` aborts in-flight generation → server aborts upstream → log
  `status=cancelled` (partial output preview + ttft + client-estimated tokens). Conversation-level
  cancel sets `conversations.status='cancelled'`.
- **List / Resume**: sidebar lists conversations; selecting one loads its messages.

### `packages/sdk` — `@ollive/sdk`
- `createOlliveClient({ ingestionUrl, openrouterApiKey, defaultModel, redactPII?, flushIntervalMs, maxBatch })`.
- `client.chat({ messages, model, provider, sessionId, conversationId, requestId, stream })`.
  `requestId` is **caller-supplied** (web server) = idempotency + correlation key.
- Captures: model, provider, latency_ms, ttft_ms (streaming), token usage, status
  (success|error|cancelled), timestamps, session/conversation id, **truncated** input/output
  previews, error type/message.
- **Token-usage nuance (OpenRouter):** authoritative usage arrives ONLY in the final SSE chunk
  (`finish_reason:"stop"`). On **success** → exact prompt/completion/total tokens. On **cancel**
  → final chunk never arrives → store `completion_tokens` as a client-side **estimate** (tokenizer
  count of received text) flagged `tokens_estimated:true` in `metadata`; leave prompt/total null.
  On **error** → token columns **null** (never `0` — zeros corrupt dashboard sums).
- **Near-real-time shipping:** internal buffer flushed on interval (default `flushIntervalMs≈1000`)
  or batch-size threshold; batched `POST /v1/logs`; exponential backoff + jitter retry; **never
  blocks or crashes the chat path** (drop after max retries with a warn); flush on process exit.

### `apps/ingestion` — producer + worker (event-based)
- **Producer (Fastify):** `POST /v1/logs` (single or batch) → zod-validate → `XADD inference:logs`
  → return **202** fast. `GET /healthz`.
- **Worker:** consumer group `ingest-workers`, `XREADGROUP` → extract metadata → PII-redact previews
  → idempotent upsert (`ON CONFLICT (request_id) DO UPDATE ... COALESCE(message_id)`) → `XACK`.
  `XAUTOCLAIM` (explicit `min-idle-time`) reclaims entries from crashed consumers.

### `packages/db` — Drizzle + Postgres
| Table | Key columns | Notes |
| --- | --- | --- |
| `conversations` | id uuid pk, title, **status** (active\|cancelled\|archived), created_at, updated_at, last_message_at | list/resume/cancel |
| `messages` | id uuid pk, conversation_id fk, **request_id uuid**, role (user\|assistant\|system), content, token_count, created_at | idx (conversation_id, created_at), idx (request_id) |
| `inference_logs` | id uuid pk, **request_id uuid UNIQUE**, conversation_id fk?, message_id fk?, model, provider, status, latency_ms, ttft_ms?, prompt_tokens?, completion_tokens?, total_tokens?, input_preview, output_preview, error_type?, error_message?, **metadata jsonb**, created_at (event time), ingested_at (proc time) | idxs: (created_at), (provider, created_at), (status, created_at), (conversation_id); UNIQUE(request_id). Token columns **nullable**. |

### Dashboards (`apps/web/dashboard`)
- Latency **p50/p95/p99** (`percentile_cont` over `date_trunc('minute', created_at)`) — **`status='success'` only**.
- Throughput (req/min, all statuses); **error rate** = `count(status!='success')/count(*)`.
- Token usage = `SUM(total_tokens) WHERE total_tokens IS NOT NULL`.
- **Pipeline-lag panel:** `ingested_at - created_at` distribution.
- **CQRS-lite:** dashboards read Postgres directly from Next server components; ingestion is
  write-only. Charts via Recharts.

### PII redaction (`packages/shared`)
- Regex redactor: emails, phone numbers, credit-card / SSN patterns, secret/key patterns
  (`sk-…`, bearer tokens). Applied in the **worker** before storing previews; behind `REDACT_PII`.

### Infra
- **Docker Compose one-command:** `docker compose up --build` → postgres + redis + ingestion
  (api+worker) + web; healthchecks; migrations on startup.
- **k8s-lite:** `infra/k8s` manifests + Helm chart for kind/minikube.

## Tradeoffs (for README)
- Postgres single-store now; Clickhouse migration path for high-volume analytics.
- Redis Streams (lightweight, consumer groups + replay) vs Kafka (higher throughput/durability).
- JSONB `metadata` (flexible) + promoted typed columns (query perf) vs full normalization.
- Worker-side PII redaction (centralized policy) vs SDK-side (defense in depth — future).
- At-least-once + idempotency (request_id) vs exactly-once.
- `created_at` (event time) vs `ingested_at` (processing time) split; lag is itself observable.

## Conventions
TypeScript **strict**, zod at all boundaries, conventional commits, vitest tests, no secrets in
code (use `.env`). Token columns null (never 0) on error/cancel.
