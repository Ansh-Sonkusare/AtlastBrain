import type { CapturePayload, CaptureResponse, MeResponse, SaveResult, Settings } from './api-types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly checkoutUrl?: string,
  ) {
    super(message);
  }
}

export function createApi(settings: Settings, fetchImpl: FetchLike = (i, init) => fetch(i, init)) {
  const base = settings.apiBase.replace(/\/+$/, '');

  async function fail(res: Response): Promise<never> {
    const body: unknown = await res.json().catch(() => null);
    const field = (key: string) =>
      body && typeof body === 'object' && key in body ? String((body as Record<string, unknown>)[key]) : undefined;
    throw new ApiError(field('error') ?? `HTTP ${res.status}`, res.status, field('checkoutUrl'));
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'x-user-id': settings.userId };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetchImpl(`${base}${path}`, { ...init, headers });
    if (!res.ok) return fail(res);
    return (await res.json().catch(() => null)) as T;
  }

  return {
    capture: (payload: CapturePayload) =>
      request<CaptureResponse>('/api/capture', { method: 'POST', body: JSON.stringify(payload) }),
    getSource: (id: string) => request<SaveResult>(`/api/sources/${encodeURIComponent(id)}`),
    me: () => request<MeResponse>('/api/me'),
  };
}

export type Api = ReturnType<typeof createApi>;
