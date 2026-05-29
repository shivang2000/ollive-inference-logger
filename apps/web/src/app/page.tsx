import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold">Ollive — Inference Logger</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        A chatbot with a lightweight SDK that logs every inference, an event-based ingestion
        pipeline, and observability dashboards.
      </p>
      <nav className="flex gap-4">
        <Link
          href="/chat"
          className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900"
        >
          Open chat
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700"
        >
          Dashboards
        </Link>
      </nav>
    </main>
  );
}
