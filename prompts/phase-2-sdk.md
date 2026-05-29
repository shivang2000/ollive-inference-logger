# Phase 2 — SDK (`@ollive/sdk`)

**Context.** Ollive.ai take-home, TS monorepo. The SDK wraps LLM calls (via OpenRouter), captures
inference metadata, and ships logs to the ingestion endpoint near real-time. Read `docs/SPEC.md`
(esp. "SDK" and the **token-usage nuance**). Reuse zod schemas from `@ollive/shared`. Conventions:
TS strict, conventional commits, vitest. Do the task, run Verify, report, STOP.

## Task
1. `createOlliveClient({ ingestionUrl, openrouterApiKey, defaultModel, redactPII?, flushIntervalMs, maxBatch })`.
2. `client.chat({ messages, model, provider, sessionId, conversationId, requestId, stream })` →
   stream or completion. **`requestId` is supplied by the caller** (idempotency + correlation key).
3. Wrap the OpenRouter call; capture model, provider, latency_ms, **ttft_ms** (streaming), token
   usage, status (`success|error|cancelled`), timestamps, session/conversation id, **truncated**
   input/output previews, error type/message.
4. **Token capture (critical):** authoritative usage is only in the final SSE chunk
   (`finish_reason:"stop"`). On success → exact tokens. On **cancel** → estimate `completion_tokens`
   (tokenizer/heuristic over received text), flag `tokens_estimated:true` in `metadata`, leave
   prompt/total null. On **error** → token columns null (never 0).
5. **Log shipping:** internal buffer flushed on `flushIntervalMs` (default ~1000ms) OR batch size;
   batched `POST {ingestionUrl}/v1/logs`; exponential backoff + jitter retry; **never block or
   crash the chat path** (drop after max retries with a warn); flush on process exit.
6. Streaming + abort/cancel support (`AbortSignal`).
7. Vitest with mocked `fetch`: metadata capture, buffer/flush/retry, cancel→estimated-tokens,
   streaming parse. Integration test against a **stub ingestion server the test spins up** (the
   real `/v1/logs` doesn't exist until Phase 3).

## Verify
- `pnpm --filter @ollive/sdk test` passes.
- (If `OPENROUTER_API_KEY` set) manual smoke: a streamed completion returns and the SDK posts a
  well-formed log to the stub server. Confirm the **live-abort** path: aborting mid-stream yields
  `status=cancelled` with estimated tokens (no final usage chunk).
- `pnpm build` green. *(Real-DB landing is verified in Phase 4.)*

**STOP and report.**
