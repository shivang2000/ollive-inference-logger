# Ollive — Inference Logger

A lightweight LLM inference logging and ingestion system: a streaming chatbot, a small
SDK that captures inference metadata, an event-based ingestion pipeline, Postgres storage,
and observability dashboards.

> Take-home for the Ollive.ai Founding Fullstack Engineer role. Full README (setup,
> architecture, schema decisions, tradeoffs) is completed in Phase 6 — see
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start (WIP)

```bash
cp .env.example .env        # set OPENROUTER_API_KEY
pnpm install
docker compose -f infra/docker-compose.yml up -d   # postgres + redis
pnpm build
```

## Monorepo layout

| Path                | What                                                          |
| ------------------- | ------------------------------------------------------------ |
| `apps/web`          | Next.js chatbot UI + dashboards + `/api/chat` (SSE)          |
| `apps/ingestion`    | Fastify `/v1/logs` producer + Redis Stream worker consumer   |
| `packages/sdk`      | `@ollive/sdk` — LLM wrapper, metadata capture, log shipping  |
| `packages/db`       | Drizzle schema + migrations                                  |
| `packages/shared`   | zod schemas, types, PII redaction                            |
| `infra/`            | docker-compose + k8s (kind/minikube) manifests               |

Stack: TypeScript · pnpm + Turborepo · Next.js 15 · Fastify · Drizzle + Postgres ·
Redis Streams · OpenRouter (multi-provider).
