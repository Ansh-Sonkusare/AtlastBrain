import type {
  CapturePayload,
  CaptureResponse,
  BrainAnswer,
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
    readonly checkoutUrl?: string,
  ) {
    super(message);
  }
}

export type ExportOutcome = { kind: 'zip'; blob: Blob } | { kind: 'upgrade'; checkoutUrl: string };

export function createApi(settings: Settings, fetchImpl: FetchLike = (i, init) => fetch(i, init)) {
  const base = settings.apiBase.replace(/\/+$/, '');

  function send(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = { 'x-user-id': settings.userId };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    return fetchImpl(`${base}${path}`, { ...init, headers });
  }

  async function fail(res: Response): Promise<never> {
    const body: unknown = await res.json().catch(() => null);
    const field = (key: string) =>
      body && typeof body === 'object' && key in body ? String((body as Record<string, unknown>)[key]) : undefined;
    throw new ApiError(field('error') ?? `HTTP ${res.status}`, res.status, field('checkoutUrl'));
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await send(path, init);
    if (!res.ok) return fail(res);
    return (await res.json().catch(() => null)) as T;
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
    ask: (question: string) =>
      request<BrainAnswer>('/api/ask', { method: 'POST', body: JSON.stringify({ question }) }),
    deleteMe: async () => {
      const res = await send('/api/me', { method: 'DELETE' });
      if (!res.ok) await fail(res);
    },
    gsql: async (name: string) => {
      const res = await send(`/api/gsql/${encodeURIComponent(name)}`, {});
      if (!res.ok) return fail(res);
      return res.text();
    },
    /** A free user gets `upgrade` with a checkout link instead of a zip. */
    exportVault: async (): Promise<ExportOutcome> => {
      const res = await send('/api/export', {});
      if (res.status === 402) {
        const err = await fail(res).catch((e: ApiError) => e);
        if (err.checkoutUrl) return { kind: 'upgrade', checkoutUrl: err.checkoutUrl };
        throw err;
      }
      if (!res.ok) return fail(res);
      return { kind: 'zip', blob: await res.blob() };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
