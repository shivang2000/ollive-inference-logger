import {
  PREVIEW_MAX_CHARS,
  redactPii,
  type ChatMessage,
  type InferenceLogInput,
  type InferenceStatus,
} from '@ollive/shared';
import {
  callOpenRouter,
  parseSseStream,
  providerFromModel,
  OPENROUTER_DEFAULT_BASE,
} from './openrouter.js';
import { estimateTokens } from './estimate.js';
import { LogShipper } from './shipper.js';
import type { ChatParams, ChatOutcome, OlliveChatResult, OlliveClientOptions } from './types.js';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function truncate(s: string, max = PREVIEW_MAX_CHARS): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function lastUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') return messages[i]!.content;
  }
  return messages[messages.length - 1]?.content ?? '';
}

function isAbort(err: unknown): boolean {
  return (
    err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
  );
}

export interface OlliveClient {
  chat(params: ChatParams): OlliveChatResult;
  /** Flush buffered logs now. */
  flush(): Promise<void>;
  /** Flush and stop (graceful shutdown). */
  close(): Promise<void>;
}

export function createOlliveClient(opts: OlliveClientOptions): OlliveClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const baseUrl = opts.openrouterBaseUrl ?? OPENROUTER_DEFAULT_BASE;
  const shipper = new LogShipper({
    ingestionUrl: opts.ingestionUrl,
    flushIntervalMs: opts.flushIntervalMs,
    maxBatch: opts.maxBatch,
    fetchImpl,
  });

  function chat(params: ChatParams): OlliveChatResult {
    const stream = params.stream ?? true;
    const model = params.model ?? opts.defaultModel ?? DEFAULT_MODEL;
    const provider = providerFromModel(model);
    const startedAt = Date.now();
    const t0 = performance.now();

    let ttftMs: number | null = null;
    let text = '';
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;
    let status: InferenceStatus = 'success';
    let errorType: string | null = null;
    let errorMessage: string | null = null;
    let tokensEstimated = false;

    let resolveCompletion!: (o: ChatOutcome) => void;
    const completion = new Promise<ChatOutcome>((resolve) => {
      resolveCompletion = resolve;
    });

    function finalize(): ChatOutcome {
      const latencyMs = Math.round(performance.now() - t0);

      if (status === 'cancelled') {
        // No final usage chunk on abort → estimate completion tokens, flag it, null the rest.
        completionTokens = estimateTokens(text);
        promptTokens = null;
        totalTokens = null;
        tokensEstimated = true;
      } else if (status === 'error') {
        promptTokens = null;
        completionTokens = null;
        totalTokens = null;
      }

      let inputPreview = truncate(lastUserContent(params.messages));
      let outputPreview = truncate(text);
      if (opts.redactPII) {
        inputPreview = redactPii(inputPreview);
        outputPreview = redactPii(outputPreview);
      }

      const log: InferenceLogInput = {
        requestId: params.requestId,
        conversationId: params.conversationId ?? null,
        sessionId: params.sessionId ?? null,
        model,
        provider,
        status,
        latencyMs,
        ttftMs,
        promptTokens,
        completionTokens,
        totalTokens,
        inputPreview,
        outputPreview,
        errorType,
        errorMessage,
        metadata: tokensEstimated ? { tokensEstimated: true } : null,
        createdAt: new Date(startedAt).toISOString(),
      };
      shipper.enqueue(log);

      const outcome: ChatOutcome = {
        requestId: params.requestId,
        status,
        text,
        model,
        provider,
        latencyMs,
        ttftMs,
        promptTokens,
        completionTokens,
        totalTokens,
        tokensEstimated,
        errorType,
        errorMessage,
      };
      resolveCompletion(outcome);
      return outcome;
    }

    async function* run(): AsyncGenerator<string> {
      try {
        const res = await callOpenRouter({
          baseUrl,
          apiKey: opts.openrouterApiKey,
          model,
          messages: params.messages,
          stream,
          signal: params.signal,
          fetchImpl,
        });

        if (!res.ok) {
          status = 'error';
          errorType = `http_${res.status}`;
          errorMessage = truncate((await res.text().catch(() => '')) || res.statusText, 500);
          return;
        }

        if (stream) {
          for await (const chunk of parseSseStream(res)) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              if (ttftMs === null) ttftMs = Math.round(performance.now() - t0);
              text += delta;
              yield delta;
            }
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? null;
              completionTokens = chunk.usage.completion_tokens ?? null;
              totalTokens = chunk.usage.total_tokens ?? null;
            }
          }
        } else {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          };
          const content = json.choices?.[0]?.message?.content ?? '';
          ttftMs = Math.round(performance.now() - t0);
          text = content;
          if (json.usage) {
            promptTokens = json.usage.prompt_tokens ?? null;
            completionTokens = json.usage.completion_tokens ?? null;
            totalTokens = json.usage.total_tokens ?? null;
          }
          if (content) yield content;
        }
      } catch (err) {
        if (isAbort(err) || params.signal?.aborted) {
          status = 'cancelled';
        } else {
          status = 'error';
          errorType = err instanceof Error ? err.name : 'unknown';
          errorMessage = truncate(err instanceof Error ? err.message : String(err), 500);
        }
      } finally {
        finalize();
      }
    }

    return { textStream: run(), completion };
  }

  return {
    chat,
    flush: () => shipper.flush(),
    close: () => shipper.close(),
  };
}
