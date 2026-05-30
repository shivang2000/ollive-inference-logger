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

export const MODELS: ModelOption[] = [
  // Paid
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
  { id: 'qwen/qwen3.7-max', label: 'Qwen3.7 Max', provider: 'qwen' },

  // Free (OpenRouter :free tier — no token cost, rate-limited). gpt-oss-120b is the most reliable.
  { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B', provider: 'openai', free: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', provider: 'meta-llama', free: true },
  { id: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash', provider: 'deepseek', free: true },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B', provider: 'qwen', free: true },
];

export const DEFAULT_MODEL_ID = MODELS[0]!.id;
