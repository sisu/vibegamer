export const MODEL_REGISTRY = [
  // Anthropic
  { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5',  provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', default: true },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  // OpenAI
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai', envKey: 'OPENAI_API_KEY' },
  { id: 'gpt-4o',      label: 'GPT-4o',      provider: 'openai', envKey: 'OPENAI_API_KEY' },
  // Google
  { id: 'gemini-3.1-flash-lite-preview', label: 'gemini-3.1-flash-lite-preview', provider: 'google', envKey: 'GOOGLE_API_KEY' },
  // Ollama — no API key; available when OLLAMA_HOST is set or defaults to localhost
  { id: 'llama3.2', label: 'Llama 3.2 (local)', provider: 'ollama', envKey: null },
  { id: 'mistral',  label: 'Mistral (local)',    provider: 'ollama', envKey: null },
  { id: 'qwen3.5:4b', label: 'qwen3.5:4b (local)', provider: 'ollama', envKey: null },
];

export function getModel(id) {
  return MODEL_REGISTRY.find(m => m.id === id) ?? null;
}

export function getDefaultModel() {
  const defaultId = process.env.DEFAULT_MODEL;
  return (defaultId && getModel(defaultId)) ?? MODEL_REGISTRY.find(m => m.default);
}

export function getAvailableModels() {
  return MODEL_REGISTRY.filter(m => m.envKey === null || process.env[m.envKey]);
}
