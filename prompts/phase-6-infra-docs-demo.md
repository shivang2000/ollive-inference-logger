# Phase 6 — Infra (k8s-lite) + Docs + Demo

**Context.** Ollive.ai take-home, TS monorepo. Final phase: one-command deploy, k8s-lite, docs,
demo. Read `docs/SPEC.md`. Conventions: TS strict, conventional commits. **Ship the must-haves
first; k8s is time-boxed and must not block submission.** Do the tasks in order, run Verify, report,
STOP.

## Task (priority order)
1. **Must-have deploy — Docker Compose one-command.** Extend `docker-compose.yml` to the full
   stack: postgres + redis + ingestion API + ingestion worker + web. Multi-stage Dockerfiles
   (Next.js `standalone` output; node for ingestion). Run DB migrations on startup. Healthchecks +
   `depends_on: condition: service_healthy`. Goal: a fresh clone runs with **one command**:
   `docker compose up --build`.
2. **Docs.** Complete `README.md` (setup, architecture overview, schema decisions, tradeoffs, "what
   I'd improve with more time") and `docs/ARCHITECTURE.md` (ingestion flow, logging strategy,
   scaling considerations, failure-handling assumptions, CQRS-lite read side, correlate-by-request_id).
   Add a mermaid architecture diagram.
3. **Demo.** Record a Loom walkthrough + capture seeded dashboard screenshots into `docs/`.
4. **k8s-lite (LAST, time-boxed).** `infra/k8s` manifests + Helm chart for kind/minikube:
   Deployments (web, ingestion-api, ingestion-worker), Services, Postgres StatefulSet + PVC, Redis,
   ConfigMap, Secret (`OPENROUTER_API_KEY`), optional Ingress. Document
   `kind create cluster && helm install ollive ./infra/k8s/helm` + port-forward.
   **Fallback:** if time runs short, ship the manifests + documented instructions even if not
   live-demoed — Docker Compose remains the validated deploy path. Do NOT let k8s block submission.

## Verify
- Fresh clone → `cp .env.example .env` (set `OPENROUTER_API_KEY`) → `docker compose up --build`
  yields a working app from one command (chat streams, logs land, dashboards populate).
- README setup steps reproduce locally; CI green.
- (If reached) `kind create cluster` → `helm install` → port-forward → app reachable.

## Submission checklist
- [ ] Public GitHub repo pushed, CI green
- [ ] README + `docs/ARCHITECTURE.md` complete
- [ ] Loom demo + screenshots
- [ ] Email repo + architecture notes + demo link to `work@ollive.ai`

**STOP — submission-ready.**
