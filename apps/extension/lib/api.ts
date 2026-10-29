import type {
  CapturePayload,
  CaptureResponse,
  LearnNextItem,
  MeResponse,
  Neighborhood,
  SaveResult,
  Settings,
} from './api-types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function createApi(settings: Settings, fetchImpl: FetchLike = (i, init) => fetch(i, init)) {
  const base = settings.apiBase.replace(/\/+$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'x-user-id': settings.userId };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetchImpl(`${base}${path}`, { ...init, headers });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
      throw new ApiError(message, res.status);
    }
    return body as T;
  }

  return {
    capture: (payload: CapturePayload) =>
      request<CaptureResponse>('/api/capture', { method: 'POST', body: JSON.stringify(payload) }),
    getSource: (id: string) => request<SaveResult>(`/api/sources/${encodeURIComponent(id)}`),
    learnNext: () => request<{ items: LearnNextItem[] }>('/api/learn-next').then((r) => r.items),
    graph: (sourceId: string) => request<Neighborhood>(`/api/graph/${encodeURIComponent(sourceId)}`),
    me: () => request<MeResponse>('/api/me'),
    checkout: (product: 'pro' | 'credits') =>
      request<{ checkoutUrl: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ product }) }),
  };
}

export type Api = ReturnType<typeof createApi>;
