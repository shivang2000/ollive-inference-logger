import { z } from 'zod';

// zod is the single source of truth for the SDK → ingestion payload. The SDK builds
// objects that satisfy these; the ingestion API validates incoming requests against them.

export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const inferenceStatusSchema = z.enum(['success', 'error', 'cancelled']);
export const conversationStatusSchema = z.enum(['active', 'cancelled', 'archived']);

export const chatMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string(),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/**
 * One inference log as emitted by the SDK. Token columns are nullable on purpose:
 * null (not 0) on error/cancel, since 0 would corrupt dashboard sums. `createdAt` is
 * the event time (when the call happened), serialized as an ISO string over the wire.
 */
export const inferenceLogSchema = z.object({
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  messageId: z.string().uuid().nullish(),
  sessionId: z.string().nullish(),
  model: z.string().min(1),
  provider: z.string().min(1),
  status: inferenceStatusSchema,
  latencyMs: z.number().int().nonnegative().nullish(),
  ttftMs: z.number().int().nonnegative().nullish(),
  promptTokens: z.number().int().nonnegative().nullish(),
  completionTokens: z.number().int().nonnegative().nullish(),
  totalTokens: z.number().int().nonnegative().nullish(),
  inputPreview: z.string().nullish(),
  outputPreview: z.string().nullish(),
  errorType: z.string().nullish(),
  errorMessage: z.string().nullish(),
  metadata: z.record(z.unknown()).nullish(),
  createdAt: z.string().datetime(),
});
export type InferenceLogInput = z.infer<typeof inferenceLogSchema>;

/** The ingestion endpoint accepts either a single log or a batch. */
export const ingestBodySchema = z.union([inferenceLogSchema, z.array(inferenceLogSchema).min(1)]);
export type IngestBody = z.infer<typeof ingestBodySchema>;
