# Ollive — Inference Logger

A lightweight LLM **inference logging and ingestion** system: a streaming chatbot, a small SDK
that captures inference metadata on every call, an **event-based** ingestion pipeline, Postgres
storage, and observability **dashboards** (latency / throughput / errors / token usage).

Built for the Ollive.ai Founding Fullstack Engineer take-home.

```
chat UI ──/api/chat (SSE)──▶ web server ──persist messages──▶ Postgres
                                  │  olliveSDK.chat()
                                  ▼
                            @ollive/sdk ──stream tokens──▶ UI
                                  │  OpenRouter (multi-provider)
                                  │  batched, non-blocking POST /v1/logs
                                  ▼
                      Fastify ingestion ──XADD──▶ Redis Stream ──▶ worker ──▶ Postgres ◀── dashboards
```

## Demo

| Dashboards | Chat |
| --- | --- |
| ![dashboards](docs/screenshots/dashboard.png) | ![chat](docs/screenshots/chat.png) |

Dashboards show latency p50/p95/p99 (successful calls), throughput with errors, per-provider
token/request breakdowns, and pipeline lag — captured from a `pnpm seed`-populated stack.

## Quick start (one command)

```bash
cp .env.example .env          # then set OPENROUTER_API_KEY (https://openrouter.ai/keys)
docker compose up --build
```

> The default model is **free** (`openai/gpt-oss-120b:free`), so an OpenRouter key with **no
> credit** works out of the box. Paid models (GPT-4o, Claude, Gemini, Qwen3.7 Max…) are in the
> picker and need credit. The free tier is a shared/rate-limited pool — if it's busy, switch model.

- Chat UI → http://localhost:3000/chat
- Dashboards → http://localhost:3000/dashboard
- Ingestion health → http://localhost:4000/healthz

Compose boots Postgres, Redis, runs migrations, then starts the ingestion API, the stream
worker, and the web app. To populate the dashboards with sample traffic without chatting:

```bash
docker compose exec ingestion-api node packages/db/dist/migrate.js   # (already run by `migrate`)
DATABASE_URL=postgres://ollive:ollive@localhost:5432/ollive pnpm seed 200
```

> If ports 5432/6379/3000/4000 are taken, set `POSTGRES_PORT` / `REDIS_PORT` / `WEB_PORT` /
> `INGESTION_PORT` in `.env`. In-container service names are used regardless, so only host
> access is affected.

## Local development (without Docker for the apps)

```bash
pnpm install
docker compose up -d postgres redis          # just the datastores
pnpm --filter @ollive/db migrate
pnpm dev                                      # web (3000) + ingestion api + worker, watch mode
pnpm seed 200                                 # optional sample data
```

`pnpm test` runs all unit + integration tests (the ingestion integration tests need Postgres +
Redis reachable via `DATABASE_URL` / `REDIS_URL`).

## Monorepo layout

| Path                | What                                                              |
| ------------------- | ---------------------------------------------------------------- |
| `apps/web`          | Next.js 15 chatbot UI + dashboards + `/api/chat` (SSE)           |
| `apps/ingestion`    | Fastify `/v1/logs` producer + Redis Stream worker consumer       |
| `packages/sdk`      | `@ollive/sdk` — LLM wrapper, metadata capture, log shipping      |
| `packages/db`       | Drizzle schema + migrations + lazy client                        |
| `packages/shared`   | zod schemas, shared types, PII redaction                         |
| `infra/k8s`         | kind/minikube manifests + Helm chart                             |
| `prompts/`          | the phased build prompts that produced this repo                 |

Stack: TypeScript (strict) · pnpm + Turborepo · Next.js 15 · Fastify · Drizzle + Postgres ·
Redis Streams · OpenRouter (multi-provider) · Recharts · vitest.

## Architecture overview

Two write paths, deliberately decoupled:

1. **Chat messages** are persisted **synchronously** by the web server — they're user-facing
   state and must be durable before the response returns.
2. **Inference logs** are shipped **asynchronously** by the SDK: a buffered, batched, non-blocking
   POST to the ingestion API, which validates and `XADD`s to a Redis Stream. A separate worker
   consumes the stream (consumer group), extracts metadata, redacts PII, and upserts into Postgres.

A telemetry outage therefore never affects chat. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the ingestion flow, logging strategy, scaling, and failure-handling details.

### Correlation across the async boundary

The web server mints one `request_id` per turn and stamps it on **both** the persisted messages
**and** the inference log (via the SDK). `request_id` is the join key end-to-end — the SDK never
needs the assistant `message_id` (which is created later, by a different process, possibly after
the log already shipped, or never on cancel). The worker's upsert backfills `message_id` via
`COALESCE` rather than dropping the row.

## Schema design decisions

Three tables (`packages/db/src/schema.ts`):

- **`conversations`** — `status` (`active | cancelled | archived`) powers list/resume/cancel.
- **`messages`** — carries `request_id` (correlation key) + indexes on `(conversation_id, created_at)`.
- **`inference_logs`** — `request_id UNIQUE` (dedup **and** correlation); **nullable** token columns;
  `metadata jsonb` for flexible extracted fields; split `created_at` (event time) vs `ingested_at`
  (processing time); indexes on `(created_at)`, `(provider, created_at)`, `(status, created_at)`,
  `(conversation_id)`.

Key choices:

- **`request_id UNIQUE` + `ON CONFLICT DO UPDATE … COALESCE`** — at-least-once delivery means the
  worker may see a `request_id` twice; this makes re-processing idempotent while still allowing a
  later event to backfill a previously-null field.
- **Nullable token columns (null, never 0)** — on error/cancel there is no authoritative usage;
  storing `0` would silently corrupt dashboard sums. On cancel, `completion_tokens` is a flagged
  client-side estimate (`metadata.tokensEstimated = true`).
- **JSONB `metadata` + promoted typed columns** — hot dashboard fields (latency, status, tokens,
  provider) are typed columns with indexes; everything else stays flexible in JSONB.
- **Event vs processing time** — `ingested_at − created_at` is itself an observable signal (the
  pipeline-lag panel).

## Tradeoffs made

- **Postgres single store** (vs Clickhouse): simpler ops; `percentile_cont` + indexes handle
  assignment-scale dashboards. Clickhouse is the migration path for high-volume time-series.
- **Redis Streams** (vs Kafka): consumer groups + acks + `XAUTOCLAIM` replay in one lightweight
  container that fits the one-command setup. Kafka is the path for higher throughput/durability.
- **Worker-side PII redaction** (vs SDK-side): one centralized, evolvable policy. SDK-side
  redaction (defense in depth) is a toggle (`redactPII`) and a future default.
- **CQRS-lite reads**: dashboards read Postgres directly from Next server components; ingestion is
  write-only. Read replicas are the scale path.
- **Regex PII redaction** (vs NER): fast and dependency-free; misses names/addresses — see below.

## What I'd improve with more time

- Clickhouse (or Timescale) for the analytics read path + materialized rollups.
- NER-based PII detection for names/addresses, and SDK-side redaction by default.
- Tracing (OpenTelemetry) so a chat turn, its log, and DB writes share a trace id.
- Backpressure metrics + alerting on ingestion lag and consumer-group pending counts.
- A dead-letter stream for poison-pill payloads instead of ack-and-warn.
- Auth + multi-tenant scoping on the ingestion endpoint.

## Deployment

- **Docker Compose** — the one-command path above (production-style: Next standalone, separate
  api/worker, migrations on startup).
- **Kubernetes (kind/minikube)** — `infra/k8s` has raw manifests and a Helm chart; see
  [`infra/k8s/README.md`](infra/k8s/README.md).

## CI

GitHub Actions runs lint, typecheck, build, migrations, and the full test suite (including the
ingestion integration tests against Postgres + Redis service containers) on every push/PR.
