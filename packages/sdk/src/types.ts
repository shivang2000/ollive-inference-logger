import type { ChatMessage, InferenceStatus } from '@ollive/shared';

/** Fetch signature — injectable so the shipper/transport are testable without a network. */
export type FetchLike = typeof globalThis.fetch;

export interface OlliveClientOptions {
  /** Base URL of the ingestion service (e.g. http://localhost:4000). */
  ingestionUrl: string;
  /** OpenRouter API key. */
  openrouterApiKey: string;
  /** Default model id (OpenRouter format, e.g. "openai/gpt-4.1"). */
  defaultModel?: string;
  /** Redact previews SDK-side before shipping (defense in depth; default false — worker redacts). */
  redactPII?: boolean;
  /** Buffer flush cadence in ms (default 1000). The latency/throughput knob. */
  flushIntervalMs?: number;
  /** Flush immediately once this many logs are buffered (default 20). */
  maxBatch?: number;
  /** Override fetch (tests). */
  fetchImpl?: FetchLike;
  /** OpenRouter base URL override (tests). */
  openrouterBaseUrl?: string;
}

export interface ChatParams {
  messages: ChatMessage[];
  /** Caller-supplied correlation + idempotency key (the web server mints it). */
  requestId: string;
  model?: string;
  conversationId?: string;
  sessionId?: string;
  /** Stream tokens (default true). */
  stream?: boolean;
  /** Abort signal — aborting yields status=cancelled. */
  signal?: AbortSignal;
}

export interface ChatOutcome {
  requestId: string;
  status: InferenceStatus;
  /** Full assistant text (possibly partial on cancel). */
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
  ttftMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** True when completionTokens is a client-side estimate (cancel path). */
  tokensEstimated: boolean;
  errorType: string | null;
  errorMessage: string | null;
}

export interface OlliveChatResult {
  /** Token stream for the UI. */
  textStream: AsyncIterable<string>;
  /** Resolves when the call finishes (success/error/cancel) with final metadata. */
  completion: Promise<ChatOutcome>;
}
