import { getConversation, getMessages, setConversationStatus } from '@/lib/conversations';
import { conversationStatusSchema } from '@ollive/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return Response.json({ error: 'not found' }, { status: 404 });
  const messages = await getMessages(id);
  return Response.json({ conversation, messages });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const parsed = conversationStatusSchema.safeParse(body.status);
  if (!parsed.success) {
    return Response.json({ error: 'invalid status' }, { status: 400 });
  }
  await setConversationStatus(id, parsed.data);
  return Response.json({ ok: true });
}
