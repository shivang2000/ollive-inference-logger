import { describe, it, expect, vi } from 'vitest';
import { LogShipper } from './shipper.js';
import type { InferenceLogInput } from '@ollive/shared';

function log(requestId: string): InferenceLogInput {
  return {
    requestId,
    model: 'openai/gpt-4o-mini',
    provider: 'openai',
    status: 'success',
    createdAt: new Date().toISOString(),
  };
}

describe('LogShipper', () => {
  it('flushes automatically when the batch size threshold is reached', async () => {
    const posts: InferenceLogInput[][] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      posts.push(JSON.parse(init.body as string));
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;

    const s = new LogShipper({ ingestionUrl: 'http://x', maxBatch: 2, flushIntervalMs: 10_000, fetchImpl });
    s.enqueue(log('a'));
    expect(posts).toHaveLength(0);
    s.enqueue(log('b')); // hits maxBatch → triggers flush

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toHaveLength(2);
  });

  it('retries on 5xx then succeeds (no throw)', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response(null, { status: n < 3 ? 500 : 202 });
    }) as unknown as typeof fetch;

    const s = new LogShipper({ ingestionUrl: 'http://x', maxBatch: 100, maxRetries: 5, fetchImpl });
    s.enqueue(log('a'));
    await s.flush();
    expect(n).toBe(3);
  });

  it('drops after exhausting retries without throwing', async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    const s = new LogShipper({ ingestionUrl: 'http://x', maxBatch: 100, maxRetries: 1, fetchImpl });
    s.enqueue(log('a'));
    await expect(s.flush()).resolves.toBeUndefined();
  });

  it('does not retry on 4xx (client error) — drops immediately', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response(null, { status: 400 });
    }) as unknown as typeof fetch;
    const s = new LogShipper({ ingestionUrl: 'http://x', maxBatch: 100, maxRetries: 5, fetchImpl });
    s.enqueue(log('a'));
    await s.flush();
    expect(n).toBe(1);
  });
});
