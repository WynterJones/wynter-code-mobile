import type { AIProvider, AIModel, ModelInfo } from '@/src/types';

// Provider colors
export const PROVIDER_COLORS: Record<AIProvider, string> = {
  claude: '#D97757',
  openai: '#10A37F',
  gemini: '#4285F4',
};

// Model configurations
export const MODELS: ModelInfo[] = [
  // Claude
  { id: 'claude-opus-4-20250514', name: 'Opus', description: 'Most capable', provider: 'claude' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet', description: 'Balanced', provider: 'claude' },
  { id: 'claude-3-5-haiku-20241022', name: 'Haiku', description: 'Fastest', provider: 'claude' },
  // OpenAI
  { id: 'gpt-5.2-codex', name: 'Codex', description: 'Balanced', provider: 'openai' },
  { id: 'gpt-5.1-codex-max', name: 'Max', description: 'Most capable', provider: 'openai' },
  { id: 'gpt-5.1-codex-mini', name: 'Mini', description: 'Fastest', provider: 'openai' },
  // Gemini
  { id: 'gemini-3-pro-preview', name: 'Pro 3', description: 'Preview', provider: 'gemini' },
  { id: 'gemini-3-flash-preview', name: 'Flash 3', description: 'Fast preview', provider: 'gemini' },
  { id: 'gemini-2.5-flash', name: 'Flash 2.5', description: 'Fast', provider: 'gemini' },
  { id: 'gemini-2.5-pro', name: 'Pro 2.5', description: 'Most capable', provider: 'gemini' },
];

export const DEFAULT_PROVIDER: AIProvider = 'claude';
export const DEFAULT_MODEL: AIModel = 'claude-sonnet-4-20250514';

// Utility functions
export function getModelName(modelId: AIModel): string {
  const model = MODELS.find((m) => m.id === modelId);
  return model?.name || modelId;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
