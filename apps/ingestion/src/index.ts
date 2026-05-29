import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { ingestBodySchema, INFERENCE_STREAM, type InferenceLogInput } from '@ollive/shared';
import { createRedis } from './redis.js';

/** Abstraction over "push logs to the stream" so the HTTP layer is testable without Redis. */
export interface StreamProducer {
  add(logs: InferenceLogInput[]): Promise<void>;
}

function redisProducer(): StreamProducer {
  const redis = createRedis();
  return {
    async add(logs) {
      const pipeline = redis.pipeline();
      for (const log of logs) {
        pipeline.xadd(INFERENCE_STREAM, '*', 'data', JSON.stringify(log));
      }
      await pipeline.exec();
    },
  };
}

export function buildServer(opts: { producer?: StreamProducer } = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const producer = opts.producer ?? redisProducer();

  app.get('/healthz', async () => ({ status: 'ok' }));

  // Thin producer: validate fast, push to the stream, ACK with 202. Processing happens
  // asynchronously in the worker so this endpoint stays cheap under load.
  app.post('/v1/logs', async (req, reply) => {
    const parsed = ingestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid payload', issues: parsed.error.issues };
    }
    const logs = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    await producer.add(logs);
    reply.code(202);
    return { accepted: logs.length };
  });

  return app;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const app = buildServer();
  const port = Number(process.env.INGESTION_PORT ?? 4000);
  app
    .listen({ port, host: '0.0.0.0' })
    .then(() => console.log(`[ingestion] api listening on :${port}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
