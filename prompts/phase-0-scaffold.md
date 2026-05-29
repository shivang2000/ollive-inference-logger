# Phase 0 — Scaffold

**Context.** You're building the Ollive.ai take-home in this repo: a lightweight LLM inference
logging + ingestion system. Stack: TypeScript monorepo (pnpm + Turborepo) — Next.js 15 web
(chatbot + dashboards), Fastify ingestion (+ Redis Streams worker), `@ollive/sdk` wrapper,
Drizzle + Postgres, shared zod/PII package, LLM via OpenRouter. Read `docs/SPEC.md` for the full
design first. Conventions: TypeScript **strict**, zod at boundaries, conventional commits,
vitest, no secrets in code. Do the task, run Verify, report, then STOP.

## Task

1. `git init` the repo.
2. Create a pnpm-workspace + Turborepo monorepo: `apps/web`, `apps/ingestion`,
   `packages/{sdk,db,shared}`. Root `package.json` with turbo scripts (build, dev, lint,
   typecheck, test, format).
3. Shared config: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), flat ESLint
   (`eslint.config.mjs` with typescript-eslint), `.prettierrc`, `.npmrc`.
4. Each package/app: `package.json` (workspace deps via `workspace:*`), `tsconfig.json`
   extending base, a stub entry point that builds.
5. `.env.example` with `OPENROUTER_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `INGESTION_URL`,
   `REDACT_PII`, ports.
6. `infra/docker-compose.yml` — **postgres + redis only** (full stack added in Phase 6),
   with healthchecks.
7. `.github/workflows/ci.yml` — install (frozen lockfile), lint, typecheck, build, test.
8. `.gitignore` (node_modules, dist, .next, .env, .turbo) — and ignore the company's assignment
   `.docx/.pdf` so they aren't redistributed.

## Verify
- `pnpm install && pnpm build` exits green.
- `docker compose -f infra/docker-compose.yml config` is valid.
- `git log` shows an initial commit.

**STOP and report.**
