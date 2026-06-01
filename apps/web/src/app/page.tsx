import Link from 'next/link';

const MODELS = ['GPT-OSS 120B', 'Llama 3.3 70B', 'DeepSeek', 'Qwen3', 'GPT-4o', 'Claude', 'Gemini'];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-7 px-6 py-16">
      <span className="w-fit rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
        ● Free · no API key · no signup
      </span>

      <div className="flex flex-col gap-3">
        <h1 className="text-5xl font-extrabold tracking-tight">OpenChat</h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Free OpenRouter models, zero setup. Talk to GPT-OSS, Llama, DeepSeek & more — without
          touching an API key.
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-3">
        <Link
          href="/chat"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-neutral-900"
        >
          Start chatting →
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Live dashboards
        </Link>
      </nav>

      <div className="flex flex-wrap gap-2">
        {MODELS.map((m) => (
          <span
            key={m}
            className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
          >
            {m}
          </span>
        ))}
      </div>

      <p className="text-xs text-neutral-400 dark:text-neutral-600">
        Powered by OpenRouter. Free models share a rate-limited pool — if one is busy, switch model
        in the chat. Built on a streaming chatbot + inference-logging pipeline.
      </p>
    </main>
  );
}
