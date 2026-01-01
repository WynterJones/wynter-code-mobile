import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { AIProvider } from '@/src/types';
import { PROVIDER_COLORS } from './shared';

interface ProviderIconProps {
  provider: AIProvider;
  size?: number;
}

export function ProviderIcon({ provider, size = 16 }: ProviderIconProps) {
  const color = PROVIDER_COLORS[provider];

  // Use FontAwesome icons with provider colors
  const icons: Record<AIProvider, string> = {
    claude: 'comment',
    openai: 'bolt',
    gemini: 'diamond',
  };

  return (
    <FontAwesome name={icons[provider] as any} size={size} color={color} />
  );
}
