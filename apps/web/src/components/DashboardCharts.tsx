'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LatencyPoint, ProviderTokens, ThroughputPoint } from '@/lib/metrics';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardCharts({
  latency,
  throughput,
  providers,
}: {
  latency: LatencyPoint[];
  throughput: ThroughputPoint[];
  providers: ProviderTokens[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Latency (ms) — successful requests, per minute">
        <LineChart data={latency}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="minute" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#22c55e" dot={false} />
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" dot={false} />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" dot={false} />
        </LineChart>
      </Panel>

      <Panel title="Throughput — requests/min (errors highlighted)">
        <BarChart data={throughput}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="minute" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" fill="#3b82f6" name="requests" />
          <Bar dataKey="errors" fill="#ef4444" name="errors" />
        </BarChart>
      </Panel>

      <Panel title="Tokens by provider">
        <BarChart data={providers} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={11} />
          <YAxis type="category" dataKey="provider" width={90} fontSize={11} />
          <Tooltip />
          <Bar dataKey="tokens" fill="#8b5cf6" name="tokens" />
        </BarChart>
      </Panel>

      <Panel title="Requests by provider">
        <BarChart data={providers} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={11} />
          <YAxis type="category" dataKey="provider" width={90} fontSize={11} />
          <Tooltip />
          <Bar dataKey="requests" fill="#14b8a6" name="requests" />
        </BarChart>
      </Panel>
    </div>
  );
}
