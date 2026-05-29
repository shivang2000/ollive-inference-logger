import { sql } from 'drizzle-orm';
import { getDb } from '@ollive/db';

// Time-range filter for the dashboards.
export type Range = '1h' | '24h' | 'all';

// Build a correct WHERE clause from the range plus any extra conditions, joined with AND.
// Always emits a leading `where` (or nothing when there are no conditions) — never a stray `and`.
function whereRange(range: Range, extra?: ReturnType<typeof sql>) {
  const conds: Array<ReturnType<typeof sql>> = [];
  if (range === '1h') conds.push(sql`created_at > now() - interval '1 hour'`);
  else if (range === '24h') conds.push(sql`created_at > now() - interval '24 hours'`);
  if (extra) conds.push(extra);
  if (conds.length === 0) return sql``;
  return sql`where ${sql.join(conds, sql` and `)}`;
}

function n(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export interface Summary {
  totalRequests: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  avgPipelineLagMs: number;
}

export async function getSummary(range: Range): Promise<Summary> {
  const db = getDb();
  const where = whereRange(range);
  const rows = (await db.execute(sql`
    select
      count(*) as total_requests,
      coalesce(avg(latency_ms) filter (where status = 'success'), 0) as avg_latency_ms,
      coalesce(percentile_cont(0.95) within group (order by latency_ms) filter (where status = 'success'), 0) as p95_latency_ms,
      coalesce(sum(total_tokens) filter (where total_tokens is not null), 0) as total_tokens,
      case when count(*) = 0 then 0 else (count(*) filter (where status <> 'success'))::float / count(*) end as error_rate,
      coalesce(avg(extract(epoch from (ingested_at - created_at)) * 1000), 0) as avg_pipeline_lag_ms
    from inference_logs
    ${where}
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0] ?? {};
  return {
    totalRequests: n(r.total_requests),
    avgLatencyMs: Math.round(n(r.avg_latency_ms)),
    p95LatencyMs: Math.round(n(r.p95_latency_ms)),
    totalTokens: n(r.total_tokens),
    errorRate: n(r.error_rate),
    avgPipelineLagMs: Math.round(n(r.avg_pipeline_lag_ms)),
  };
}

export interface LatencyPoint {
  minute: string;
  p50: number;
  p95: number;
  p99: number;
}

export async function getLatencySeries(range: Range): Promise<LatencyPoint[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    select
      to_char(date_trunc('minute', created_at), 'HH24:MI') as minute,
      percentile_cont(0.5) within group (order by latency_ms) as p50,
      percentile_cont(0.95) within group (order by latency_ms) as p95,
      percentile_cont(0.99) within group (order by latency_ms) as p99
    from inference_logs
    ${whereRange(range, sql`status = 'success'`)}
    group by 1
    order by 1
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    minute: String(r.minute),
    p50: Math.round(n(r.p50)),
    p95: Math.round(n(r.p95)),
    p99: Math.round(n(r.p99)),
  }));
}

export interface ThroughputPoint {
  minute: string;
  total: number;
  errors: number;
}

export async function getThroughputSeries(range: Range): Promise<ThroughputPoint[]> {
  const db = getDb();
  const where = whereRange(range);
  const rows = (await db.execute(sql`
    select
      to_char(date_trunc('minute', created_at), 'HH24:MI') as minute,
      count(*) as total,
      count(*) filter (where status <> 'success') as errors
    from inference_logs
    ${where}
    group by 1
    order by 1
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({ minute: String(r.minute), total: n(r.total), errors: n(r.errors) }));
}

export interface ProviderTokens {
  provider: string;
  tokens: number;
  requests: number;
}

export async function getProviderBreakdown(range: Range): Promise<ProviderTokens[]> {
  const db = getDb();
  const where = whereRange(range);
  const rows = (await db.execute(sql`
    select provider,
      coalesce(sum(total_tokens) filter (where total_tokens is not null), 0) as tokens,
      count(*) as requests
    from inference_logs
    ${where}
    group by provider
    order by tokens desc
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    provider: String(r.provider),
    tokens: n(r.tokens),
    requests: n(r.requests),
  }));
}
