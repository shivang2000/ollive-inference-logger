import type { ChatMessage } from '@ollive/shared';
import type { FetchLike } from './types.js';

export const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface OpenRouterChunk {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: OpenRouterUsage;
}

export interface OpenRouterRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  signal?: AbortSignal;
  fetchImpl: FetchLike;
}

export function callOpenRouter(req: OpenRouterRequest): Promise<Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream,
  };
  // Ask for usage on the final SSE chunk (OpenAI-compatible flag).
  if (req.stream) body.stream_options = { include_usage: true };

  return req.fetchImpl(`${req.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${req.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });
}

/**
 * Parse an OpenRouter/OpenAI SSE stream into JSON chunks. Yields each `data:` payload until the
 * terminal `[DONE]`. Authoritative token usage (when present) rides the final chunk — which is
 * exactly why an aborted stream has no usage, and the SDK estimates instead.
 */
export async function* parseSseStream(res: Response): AsyncGenerator<OpenRouterChunk> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data) as OpenRouterChunk;
        } catch {
          // ignore keep-alive / partial lines
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

/** Derive the upstream provider from an OpenRouter model id ("openai/gpt-4.1" → "openai"). */
export function providerFromModel(model: string): string {
  const slash = model.indexOf('/');
  return slash > 0 ? model.slice(0, slash) : 'openrouter';
}
