import Link from 'next/link';
import {
  getLatencySeries,
  getProviderBreakdown,
  getSummary,
  getThroughputSeries,
  type Range,
} from '@/lib/metrics';
import DashboardCharts from '@/components/DashboardCharts';

export const dynamic = 'force-dynamic';

const RANGES: { key: Range; label: string }[] = [
  { key: '1h', label: 'Last hour' },
  { key: '24h', label: 'Last 24h' },
  { key: 'all', label: 'All time' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: raw } = await searchParams;
  const range: Range = raw === '24h' || raw === 'all' ? raw : '1h';

  const [summary, latency, throughput, providers] = await Promise.all([
    getSummary(range),
    getLatencySeries(range),
    getThroughputSeries(range),
    getProviderBreakdown(range),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inference Dashboards</h1>
          <Link href="/chat" className="text-sm text-blue-600 hover:underline">
            ← back to chat
          </Link>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/dashboard?range=${r.key}`}
              className={`rounded-md px-3 py-1 text-sm ${
                r.key === range
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'border border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Requests" value={summary.totalRequests.toLocaleString()} />
        <Stat label="Error rate" value={`${(summary.errorRate * 100).toFixed(1)}%`} />
        <Stat label="Avg latency" value={`${summary.avgLatencyMs} ms`} />
        <Stat label="p95 latency" value={`${summary.p95LatencyMs} ms`} />
        <Stat label="Tokens" value={summary.totalTokens.toLocaleString()} />
        <Stat label="Pipeline lag" value={`${summary.avgPipelineLagMs} ms`} />
      </div>

      {summary.totalRequests === 0 ? (
        <p className="text-neutral-500">
          No inference logs yet. Run <code>pnpm seed</code> or start chatting.
        </p>
      ) : (
        <DashboardCharts latency={latency} throughput={throughput} providers={providers} />
      )}
    </main>
  );
}
