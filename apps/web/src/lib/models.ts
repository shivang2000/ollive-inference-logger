// Models offered in the picker — all routed through OpenRouter, spanning multiple upstream
// providers (this is the multi-provider bonus: one key, many providers).
export interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

export const MODELS: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
];

export const DEFAULT_MODEL_ID = MODELS[0]!.id;
