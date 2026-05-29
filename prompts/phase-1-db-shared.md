# Phase 1 — Database + Shared

**Context.** Ollive.ai take-home, TS monorepo (pnpm + Turborepo): Next.js web, Fastify ingestion
+ Redis worker, `@ollive/sdk`, Drizzle + Postgres, shared zod/PII package, OpenRouter. Read
`docs/SPEC.md` first (esp. the schema table and "correlation across the async boundary").
Conventions: TS strict, zod at boundaries, conventional commits, vitest. Do the task, run Verify,
report, STOP.

## Task

**`packages/db` (Drizzle + Postgres):**
1. `src/schema.ts` — tables `conversations`, `messages`, `inference_logs` exactly per `docs/SPEC.md`:
   - `messages.request_id uuid` (correlation key) + index.
   - `inference_logs.request_id uuid UNIQUE` (dedup + correlation); token columns **nullable**;
     `metadata jsonb`; split `created_at` (event) vs `ingested_at` (processing); indexes on
     `(created_at)`, `(provider, created_at)`, `(status, created_at)`, `(conversation_id)`.
   - `conversations.status` enum: `active | cancelled | archived`.
2. `src/client.ts` — postgres-js client + drizzle instance from `DATABASE_URL`.
3. `drizzle.config.ts` + generated SQL migrations; `src/migrate.ts` runner (`pnpm migrate`).
4. Export schema + client + inferred types from `src/index.ts`.

**`packages/shared`:**
5. zod schemas: `InferenceLogSchema` (the SDK→ingestion payload), chat message types, status enums.
   Keep these the single source of truth imported by the SDK and ingestion.
6. `redactPii(text: string): string` — redact emails, phone numbers, credit-card / SSN patterns,
   secret/key patterns (`sk-…`, bearer tokens). Behind `REDACT_PII`.
7. Vitest for the redactor: positive cases (each PII type redacted) + negative cases (ordinary text
   untouched, no false positives on things like version numbers).

## Verify
- Precondition: `docker compose -f infra/docker-compose.yml up -d postgres`.
- `pnpm --filter @ollive/db migrate` applies cleanly; tables + indexes exist.
- `pnpm --filter @ollive/shared test` passes.
- `pnpm build` green.

**STOP and report.**
