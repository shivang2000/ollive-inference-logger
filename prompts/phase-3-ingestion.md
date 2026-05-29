# Phase 3 — Ingestion + Worker (event-based)

**Context.** Ollive.ai take-home, TS monorepo. Build the event-based ingestion: a Fastify producer
that ACKs fast and pushes to a Redis Stream, and a worker consumer that processes and stores. Read
`docs/SPEC.md` (esp. "ingestion + worker" and "correlation across the async boundary"). Reuse zod
from `@ollive/shared` and schema/client from `@ollive/db`. Conventions: TS strict, vitest. Do the
task, run Verify, report, STOP.

## Task
**Producer (`apps/ingestion/src/index.ts`, Fastify):**
1. `POST /v1/logs` — accepts a single log or a batch array; zod-validate with the shared schema;
   `XADD inference:logs` per entry; return **202** immediately. Reject invalid payloads with 400.
2. `GET /healthz`.

**Worker (`apps/ingestion/src/worker.ts`):**
3. Consumer group `ingest-workers` (create if absent). Loop `XREADGROUP` → for each entry: parse,
   extract metadata, **PII-redact** previews (via `@ollive/shared`, behind `REDACT_PII`), then
   **idempotent upsert** into `inference_logs`:
   `ON CONFLICT (request_id) DO UPDATE SET message_id = COALESCE(inference_logs.message_id, EXCLUDED.message_id), ...`
   (so later enrichment backfills without dropping the row) → `XACK`.
4. `XAUTOCLAIM` with an explicit `min-idle-time` to reclaim entries from crashed consumers.

**Tests:** zod validation (good/bad payloads), producer XADD (mock redis), worker idempotency
(duplicate `request_id` → exactly one row), redaction applied to stored previews.

## Verify
- Precondition: postgres + redis up (`docker compose -f docker-compose.yml up -d`).
- POST sample logs → rows appear in `inference_logs`.
- Kill the worker mid-stream, restart → pending entries are reclaimed via `XAUTOCLAIM` (use a short
  `min-idle-time` for the test) and result in **no lost rows and no duplicate rows** (at-least-once
  + idempotent dedup — not "exactly once"). Re-POST a duplicate `request_id` → still one row.
- `pnpm --filter @ollive/ingestion test` passes; `pnpm build` green.

**STOP and report.**
