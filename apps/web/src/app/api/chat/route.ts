import { ollive } from '@/lib/ollive';
import {
  addMessage,
  contextWindow,
  createConversation,
  setConversationTitleIfEmpty,
} from '@/lib/conversations';
import { DEFAULT_MODEL_ID } from '@/lib/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatRequest {
  conversationId?: string;
  content: string;
  model?: string;
  sessionId?: string;
}

function sse(event: string | null, data: unknown): Uint8Array {
  const prefix = event ? `event: ${event}\n` : '';
  return new TextEncoder().encode(`${prefix}data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }

  const model = body.model ?? DEFAULT_MODEL_ID;
  const isNew = !body.conversationId;
  const conversationId = body.conversationId ?? (await createConversation()).id;
  if (isNew) {
    await setConversationTitleIfEmpty(conversationId, body.content.trim().slice(0, 60));
  }

  // Mint the correlation id, persist the user turn, then build the context window (which now
  // includes this user message).
  const requestId = crypto.randomUUID();
  await addMessage(conversationId, 'user', body.content, requestId);
  const messages = await contextWindow(conversationId);

  const result = ollive().chat({
    messages,
    requestId,
    conversationId,
    sessionId: body.sessionId,
    model,
    stream: true,
    signal: req.signal,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          // client disconnected — ignore; the SDK still finalizes + logs.
        }
      };

      safeEnqueue(sse('meta', { conversationId, requestId, model }));
      try {
        for await (const token of result.textStream) {
          safeEnqueue(sse(null, { token }));
        }
      } catch {
        // streaming aborted/errored — outcome below reflects it.
      }

      const outcome = await result.completion;
      if (outcome.text) {
        // The worker links this log → message by request_id; no web-side UPDATE needed.
        await addMessage(
          conversationId,
          'assistant',
          outcome.text,
          requestId,
          outcome.completionTokens ?? undefined,
        );
      }
      safeEnqueue(sse('done', { status: outcome.status, latencyMs: outcome.latencyMs }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
