import { createAnthropicProvider, HAIKU, SONNET } from './anthropic';
import { createOllamaProvider } from './ollama';
import { stubProvider } from './stub';
import type { LlmProfile, LlmProvider } from './types';

export * from './types';
export * from './schemas';
export { CostCapError } from './cost';

const PROFILES: readonly LlmProfile[] = ['stub', 'local', 'cheap', 'demo'];

function underTest(): boolean {
  return Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
}

export function createLlm(profile: string = process.env.LLM_PROFILE ?? 'stub'): LlmProvider {
  if (!PROFILES.includes(profile as LlmProfile)) throw new Error(`Unknown LLM_PROFILE: ${profile}`);
  if (underTest() && profile !== 'stub') {
    throw new Error(`LLM_PROFILE=${profile} is not allowed under test; use stub`);
  }
  switch (profile as LlmProfile) {
    case 'stub':
      return stubProvider;
    case 'local':
      return createOllamaProvider();
    case 'cheap':
      return createAnthropicProvider({
        models: { split: HAIKU, link: HAIKU, tldr: HAIKU },
        fallback: createOllamaProvider(),
      });
    case 'demo':
      return createAnthropicProvider({
        models: { split: SONNET, link: HAIKU, tldr: SONNET },
        fallback: createOllamaProvider(),
      });
  }
}
