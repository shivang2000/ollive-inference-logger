# Phase 5 — Dashboards

**Context.** Ollive.ai take-home, TS monorepo. Build observability dashboards over the inference
logs. Read `docs/SPEC.md` (esp. "Dashboards" — note the aggregation semantics). Read Postgres
directly from Next server components (CQRS-lite). Conventions: TS strict. Do the task, run Verify,
report, STOP.

## Task
1. **`/dashboard`** page with panels:
   - **Latency** p50 / p95 / p99 via `percentile_cont` over `date_trunc('minute', created_at)`
     buckets — **`WHERE status='success'` only**.
   - **Throughput** — requests/min (all statuses).
   - **Error rate** — `count(status!='success')::float / count(*)` (its own metric).
   - **Token usage** — `SUM(total_tokens) WHERE total_tokens IS NOT NULL`, by provider/model.
   - **Pipeline lag** — distribution of `ingested_at - created_at`.
2. Filters: provider/model + time range.
3. Server-side aggregate queries (Drizzle/SQL) in Next server components; Recharts for charts.
4. **`scripts/seed.ts`** — generate synthetic traffic with a realistic mix of
   `success / error / cancelled` rows (and some null-token rows) so the dashboards demonstrably
   handle all cases.

## Verify
- Run `scripts/seed.ts` → dashboard numbers match hand-computed aggregates from the seed (verify
  the success-only percentile filter and the null-token exclusion specifically).
- `pnpm build` green.

**STOP and report.**
