import type { Metadata } from 'next';
import './globals.css';

const title = 'OpenChat — Free AI Chat, No API Key';
const description =
  'Talk to GPT-OSS 120B, Llama 3.3, DeepSeek, Qwen & more — free, in your browser. No OpenRouter API key, no setup.';
const url = 'https://ai-chat.shivangchheda.dev';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  applicationName: 'OpenChat',
  openGraph: {
    type: 'website',
    siteName: 'OpenChat',
    url,
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
