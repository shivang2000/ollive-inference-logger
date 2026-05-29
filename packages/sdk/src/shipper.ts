import type { InferenceLogInput } from '@ollive/shared';
import type { FetchLike } from './types.js';

export interface ShipperOptions {
  ingestionUrl: string;
  flushIntervalMs?: number;
  maxBatch?: number;
  maxRetries?: number;
  fetchImpl?: FetchLike;
}

/**
 * Buffers inference logs and ships them to the ingestion endpoint in batches. Designed to never
 * impact the chat path: failures are retried with exponential backoff + jitter, and ultimately
 * dropped with a warning rather than thrown. Flush triggers: interval timer OR batch-size threshold.
 */
export class LogShipper {
  private buf: InferenceLogInput[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatch: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: ShipperOptions) {
    this.url = `${opts.ingestionUrl.replace(/\/$/, '')}/v1/logs`;
    this.flushIntervalMs = opts.flushIntervalMs ?? 1000;
    this.maxBatch = opts.maxBatch ?? 20;
    this.maxRetries = opts.maxRetries ?? 4;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  enqueue(log: InferenceLogInput): void {
    this.buf.push(log);
    if (this.buf.length >= this.maxBatch) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
    // Don't keep the process alive just for a pending flush (Node only).
    (this.timer as { unref?: () => void }).unref?.();
  }

  /** Flush the buffer now. Resolves once the in-flight batch has been attempted. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buf.length === 0) return;
    const batch = this.buf.splice(0, this.buf.length);
    await this.post(batch);
  }

  private async post(batch: InferenceLogInput[]): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        });
        if (res.ok) return;
        // 4xx (except 429) is a client bug — retrying won't help; drop.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          console.warn(`[ollive-sdk] ingestion rejected batch (${res.status}); dropping`);
          return;
        }
      } catch {
        // network error — fall through to backoff
      }
      if (attempt < this.maxRetries) {
        const backoff = 200 * 2 ** attempt + Math.floor(Math.random() * 100);
        await delay(backoff);
      }
    }
    console.warn(`[ollive-sdk] failed to ship ${batch.length} log(s) after retries; dropping`);
  }

  /** Flush and stop — call on graceful shutdown. */
  async close(): Promise<void> {
    await this.flush();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
