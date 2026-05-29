import { describe, it, expect } from 'vitest';
import { buildServer, type StreamProducer } from './index.js';
import type { InferenceLogInput } from '@ollive/shared';

function fakeProducer() {
  const added: InferenceLogInput[] = [];
  const producer: StreamProducer = {
    async add(logs) {
      added.push(...logs);
    },
  };
  return { producer, added };
}

function validLog(): InferenceLogInput {
  return {
    requestId: crypto.randomUUID(),
    model: 'openai/gpt-4o-mini',
    provider: 'openai',
    status: 'success',
    createdAt: new Date().toISOString(),
  };
}

describe('ingestion API', () => {
  it('GET /healthz returns ok', async () => {
    const { producer } = fakeProducer();
    const app = buildServer({ producer });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('accepts a single log with 202 and enqueues it', async () => {
    const { producer, added } = fakeProducer();
    const app = buildServer({ producer });
    const res = await app.inject({ method: 'POST', url: '/v1/logs', payload: validLog() });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 1 });
    expect(added).toHaveLength(1);
    await app.close();
  });

  it('accepts a batch of logs', async () => {
    const { producer, added } = fakeProducer();
    const app = buildServer({ producer });
    const res = await app.inject({ method: 'POST', url: '/v1/logs', payload: [validLog(), validLog()] });
    expect(res.statusCode).toBe(202);
    expect(added).toHaveLength(2);
    await app.close();
  });

  it('rejects an invalid payload with 400 and enqueues nothing', async () => {
    const { producer, added } = fakeProducer();
    const app = buildServer({ producer });
    const res = await app.inject({ method: 'POST', url: '/v1/logs', payload: { nope: true } });
    expect(res.statusCode).toBe(400);
    expect(added).toHaveLength(0);
    await app.close();
  });
});
