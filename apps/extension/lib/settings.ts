import type { Settings } from './api-types';

export const DEFAULT_SETTINGS: Settings = { apiBase: 'http://localhost:3000', userId: 'demo' };

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(['apiBase', 'userId']);
  return {
    apiBase: typeof stored.apiBase === 'string' && stored.apiBase ? stored.apiBase : DEFAULT_SETTINGS.apiBase,
    userId: typeof stored.userId === 'string' && stored.userId ? stored.userId : DEFAULT_SETTINGS.userId,
  };
}

export function saveSettings(settings: Settings): Promise<void> {
  return browser.storage.local.set({ apiBase: settings.apiBase.trim(), userId: settings.userId.trim() });
}
