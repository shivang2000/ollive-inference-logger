import { createConversation, listConversations } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json(await listConversations());
}

export async function POST(): Promise<Response> {
  const conversation = await createConversation();
  return Response.json(conversation, { status: 201 });
}
