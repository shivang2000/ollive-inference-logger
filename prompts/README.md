# Build Prompts

Phased executor prompts that build this project. Each is self-contained and runnable in a
fresh AI coding session (Claude Code, Codex, etc.) or via an executor agent. Every phase ends
with a **verify gate** and a **STOP-and-report** so you review before advancing.

Canonical design lives in [`docs/SPEC.md`](../docs/SPEC.md) — each prompt references it.

## Order

| # | Prompt | Builds | Needs `OPENROUTER_API_KEY`? |
| - | ------ | ------ | --------------------------- |
| 0 | [phase-0-scaffold.md](phase-0-scaffold.md) | monorepo skeleton, configs, CI, compose stub | no |
| 1 | [phase-1-db-shared.md](phase-1-db-shared.md) | Drizzle schema + migrations, zod, PII redactor | no |
| 2 | [phase-2-sdk.md](phase-2-sdk.md) | `@ollive/sdk` wrapper + log shipping | live smoke only |
| 3 | [phase-3-ingestion.md](phase-3-ingestion.md) | Fastify producer + Redis Stream worker | no |
| 4 | [phase-4-chatbot.md](phase-4-chatbot.md) | chat UI, SSE, list/resume/cancel | yes |
| 5 | [phase-5-dashboards.md](phase-5-dashboards.md) | latency/throughput/error dashboards + seed | no |
| 6 | [phase-6-infra-docs-demo.md](phase-6-infra-docs-demo.md) | compose one-command, k8s-lite, docs, demo | yes (demo) |

## How to run

1. Open a fresh session in the repo root.
2. Paste the next phase's prompt.
3. Let it run to the **Verify** step; review the reported results.
4. If green, move to the next phase. If not, iterate within the phase.

The prompt already includes the shared preamble (stack, conventions). You only paste one file.
