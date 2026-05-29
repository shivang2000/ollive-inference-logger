import Redis from 'ioredis';

/**
 * Create an ioredis client. `maxRetriesPerRequest: null` is required for blocking commands
 * (XREADGROUP ... BLOCK) used by the worker.
 */
export function createRedis(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: null });
}
