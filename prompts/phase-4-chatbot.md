# Phase 4 — Chatbot App

**Context.** Ollive.ai take-home, TS monorepo. Build the chatbot UI + chat API that uses
`@ollive/sdk`, streams via SSE, and persists conversations. Read `docs/SPEC.md` (esp. "apps/web"
and "correlation across the async boundary"). Reuse `@ollive/sdk`, `@ollive/db`, `@ollive/shared`.
Conventions: TS strict, conventional commits. Needs `OPENROUTER_API_KEY` to run live. Do the task,
run Verify, report, STOP.

## Task
1. **Chat UI** (`/chat`): message list, composer, model/provider picker, conversation sidebar.
2. **`POST /api/chat`** route handler: **generate `request_id`** → load short context window (last
   ~10 messages or token-budgeted) from Postgres → persist the user message (with `request_id`) →
   call `olliveSDK.chat({ stream:true, requestId, conversationId })` → stream tokens to the client
   via **SSE** → persist the assistant message (same `request_id`) on completion.
3. **Multi-turn + short context** assembled per request from the `messages` table.
4. **Cancel** (frontend bonus): client `AbortController` → server aborts the upstream stream → the
   SDK finalizes `status=cancelled`. Add a conversation-level cancel that sets
   `conversations.status='cancelled'`.
5. **List / Resume** (frontend bonus): sidebar lists conversations; selecting one loads its
   messages to resume.
6. Conversation auto-titling from the first user message.

## Verify
- Precondition: postgres + redis up; ingestion API + worker running; `OPENROUTER_API_KEY` set.
- End-to-end: send a message → tokens stream in; refresh → conversation + messages persisted.
- List shows conversations; resume loads history; cancel stops generation and marks the
  conversation cancelled.
- Inference logs for each turn land in `inference_logs` (SDK → ingestion → worker → DB), correlated
  by `request_id`.
- `pnpm build` green.

**STOP and report.**
