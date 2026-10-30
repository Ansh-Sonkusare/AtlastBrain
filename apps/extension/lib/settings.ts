import type { Settings } from './api-types';

export const DEFAULT_API_BASE: string = import.meta.env.WXT_APP_ORIGIN || 'http://localhost:3000';

export const DEFAULT_SETTINGS: Settings = { apiBase: DEFAULT_API_BASE, token: '' };

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(['apiBase', 'token']);
  return {
    apiBase: typeof stored.apiBase === 'string' && stored.apiBase ? stored.apiBase : DEFAULT_SETTINGS.apiBase,
    token: typeof stored.token === 'string' ? stored.token : '',
  };
}

export function saveApiBase(apiBase: string): Promise<void> {
  return browser.storage.local.set({ apiBase: apiBase.trim() });
}

/** The token is only good for the app that signed it, so its origin becomes the API base. */
export function connectAccount(token: string, apiBase: string): Promise<void> {
  return browser.storage.local.set({ token, apiBase });
}

export function disconnect(): Promise<void> {
  return browser.storage.local.remove('token');
}

export function connectUrl(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, '')}/extension/connect?ext=${browser.runtime.id}`;
}
