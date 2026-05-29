import { describe, it, expect } from 'vitest';
import { createOlliveClient } from './client.js';
import type { InferenceLogInput } from '@ollive/shared';

const enc = new TextEncoder();

/** A 200 SSE response that emits the given chunks then [DONE]. */
function sseResponse(chunks: object[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

/** An SSE response that emits some tokens then errors as an aborted connection would. */
function abortedResponse(tokens: string[]): Response {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < tokens.length) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: tokens[i++] } }] })}\n\n`));
      } else {
        c.error(new DOMException('The operation was aborted', 'AbortError'));
      }
    },
  });
  return new Response(stream, { status: 200 });
}

function harness() {
  const shipped: InferenceLogInput[] = [];
  let openrouter: () => Response = () => sseResponse([]);
  const fetchImpl = (async (url: string, init: RequestInit) => {
    if (String(url).includes('/v1/logs')) {
      shipped.push(...(JSON.parse(init.body as string) as InferenceLogInput[]));
      return new Response(null, { status: 202 });
    }
    return openrouter();
  }) as unknown as typeof fetch;

  const client = createOlliveClient({
    ingestionUrl: 'http://ingest',
    openrouterApiKey: 'test-key',
    openrouterBaseUrl: 'http://openrouter',
    flushIntervalMs: 5,
    fetchImpl,
  });
  return { client, shipped, setOpenRouter: (f: () => Response) => (openrouter = f) };
}

async function drain(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const t of stream) out += t;
  return out;
}

describe('createOlliveClient.chat', () => {
  it('streams tokens and captures exact usage on success', async () => {
    const { client, shipped, setOpenRouter } = harness();
    setOpenRouter(() =>
      sseResponse([
        { choices: [{ delta: { content: 'Hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        { choices: [{ finish_reason: 'stop', delta: {} }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
      ]),
    );

    const requestId = crypto.randomUUID();
    const r = client.chat({ messages: [{ role: 'user', content: 'hi' }], requestId, model: 'openai/gpt-4o-mini' });
    const text = await drain(r.textStream);
    const outcome = await r.completion;
    await client.flush();

    expect(text).toBe('Hello');
    expect(outcome.status).toBe('success');
    expect(outcome.completionTokens).toBe(2);
    expect(outcome.totalTokens).toBe(7);
    expect(outcome.tokensEstimated).toBe(false);
    expect(outcome.ttftMs).not.toBeNull();
    expect(outcome.provider).toBe('openai');

    expect(shipped).toHaveLength(1);
    expect(shipped[0]!.requestId).toBe(requestId);
    expect(shipped[0]!.status).toBe('success');
    expect(shipped[0]!.totalTokens).toBe(7);
  });

  it('on cancel: estimates completion tokens, nulls prompt/total, flags estimate', async () => {
    const { client, shipped, setOpenRouter } = harness();
    setOpenRouter(() => abortedResponse(['par', 'tial']));

    const r = client.chat({ messages: [{ role: 'user', content: 'hi' }], requestId: crypto.randomUUID() });
    const text = await drain(r.textStream);
    const outcome = await r.completion;
    await client.flush();

    expect(text).toBe('partial');
    expect(outcome.status).toBe('cancelled');
    expect(outcome.tokensEstimated).toBe(true);
    expect(outcome.completionTokens).toBeGreaterThan(0);
    expect(outcome.promptTokens).toBeNull();
    expect(outcome.totalTokens).toBeNull();
    expect(shipped[0]!.metadata).toEqual({ tokensEstimated: true });
  });

  it('on HTTP error: status=error, token columns null', async () => {
    const { client, shipped, setOpenRouter } = harness();
    setOpenRouter(() => new Response('upstream boom', { status: 500, statusText: 'Server Error' }));

    const r = client.chat({ messages: [{ role: 'user', content: 'hi' }], requestId: crypto.randomUUID() });
    await drain(r.textStream);
    const outcome = await r.completion;
    await client.flush();

    expect(outcome.status).toBe('error');
    expect(outcome.errorType).toBe('http_500');
    expect(outcome.completionTokens).toBeNull();
    expect(shipped[0]!.status).toBe('error');
  });

  it('supports non-streaming completions', async () => {
    const { client, setOpenRouter } = harness();
    setOpenRouter(() =>
      Response.json({
        choices: [{ message: { content: 'Hi there' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    );

    const r = client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      requestId: crypto.randomUUID(),
      stream: false,
    });
    const text = await drain(r.textStream);
    const outcome = await r.completion;

    expect(text).toBe('Hi there');
    expect(outcome.totalTokens).toBe(5);
  });
});
