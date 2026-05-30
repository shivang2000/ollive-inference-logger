'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/models';

interface Conversation {
  id: string;
  title: string | null;
  status: 'active' | 'cancelled' | 'archived';
  lastMessageAt: string | null;
}

interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function parseSseBlock(block: string): { event: string; data: unknown } {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return { event, data: data ? JSON.parse(data) : null };
}

export default function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    if (res.ok) setConversations(await res.json());
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = (await res.json()) as { messages: UiMessage[] };
      setMessages(data.messages);
    }
  }, []);

  const newConversation = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  const cancelConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await refreshConversations();
    },
    [refreshConversations],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || streaming) return;
    setInput('');
    setStreaming(true);

    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', content };
    const assistantMsg: UiMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '' };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;
    let convId = activeId;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, content, model }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error('no stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!block.trim()) continue;
          const { event, data } = parseSseBlock(block);
          if (event === 'meta') {
            convId = (data as { conversationId: string }).conversationId;
            if (!activeId) setActiveId(convId);
          } else if (event === 'done') {
            // finalized server-side
          } else {
            const token = (data as { token: string }).token;
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantMsg.id ? { ...msg, content: msg.content + token } : msg,
              ),
            );
          }
        }
      }
    } catch {
      // aborted or network error — keep whatever streamed so far
    } finally {
      setStreaming(false);
      abortRef.current = null;
      void refreshConversations();
    }
  }, [activeId, input, model, streaming, refreshConversations]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between p-3">
          <span className="font-semibold">Conversations</span>
          <button
            onClick={newConversation}
            className="rounded-md bg-neutral-900 px-2 py-1 text-sm text-white dark:bg-white dark:text-neutral-900"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
                c.id === activeId ? 'bg-neutral-100 dark:bg-neutral-900' : ''
              }`}
            >
              <button onClick={() => selectConversation(c.id)} className="flex-1 truncate text-left">
                {c.title ?? 'Untitled'}
                {c.status === 'cancelled' && (
                  <span className="ml-1 text-xs text-amber-600">(cancelled)</span>
                )}
              </button>
              <button
                onClick={() => cancelConversation(c.id)}
                title="Cancel conversation"
                className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-amber-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <p className="text-neutral-500">Start a conversation below.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800'
                }`}
              >
                {m.content || (m.role === 'assistant' && streaming ? '…' : '')}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <div className="mb-2 flex items-center gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
            >
              <optgroup label="Paid">
                {MODELS.filter((m) => !m.free).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Free">
                {MODELS.filter((m) => m.free).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} (free)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Message…"
              className="flex-1 resize-none rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />
            {streaming ? (
              <button
                onClick={stop}
                className="rounded-md bg-amber-600 px-4 text-sm font-medium text-white"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => void send()}
                disabled={!input.trim()}
                className="rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
