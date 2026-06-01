// Models offered in the picker — all routed through OpenRouter, spanning multiple upstream
// providers (this is the multi-provider bonus: one key, many providers). The `:free` models
// are OpenRouter's free tier (zero token cost, but a shared/rate-limited pool — they can
// transiently return provider errors, which the pipeline logs as status=error).
export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  free?: boolean;
}

// All ids validated against the OpenRouter API (dead/renamed slugs return 404; flaky free models
// return 429/402). Keep this list to currently-served models so the picker never offers a broken option.
export const MODELS: ModelOption[] = [
  // Paid
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
  { id: 'qwen/qwen3.7-max', label: 'Qwen3.7 Max', provider: 'qwen' },

  // Free (OpenRouter :free tier — no token cost, shared/rate-limited pool). gpt-oss-120b is the most reliable.
  { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B', provider: 'openai', free: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', provider: 'meta-llama', free: true },
];

// Default to a free model so the app works with just an OpenRouter key (no credit needed).
// gpt-oss-120b:free chosen empirically: top-capability among free models AND the most
// reliable on the shared free tier (others frequently rate-limit). Paid models remain in the picker.
export const DEFAULT_MODEL_ID = 'openai/gpt-oss-120b:free';
