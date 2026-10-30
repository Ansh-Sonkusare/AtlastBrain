import type { ExplainNode } from '../../server/llm/types';
import type { BrainAnswer, Neighborhood } from '../../server/types';

/** Browser-side calls to our own API routes. There is no auth yet, so the user id is a header. */
async function call(user: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { 'x-user-id': user };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return fetch(path, { ...init, headers });
}

async function fail(res: Response): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '';
  throw new Error(message || `HTTP ${res.status}`);
}

async function json<T>(res: Response): Promise<T> {
  return res.ok ? ((await res.json()) as T) : fail(res);
}

export const ask = (user: string, question: string) =>
  call(user, '/api/ask', { method: 'POST', body: JSON.stringify({ question }) }).then((r) => json<BrainAnswer>(r));

export const explain = (user: string, node: ExplainNode, neighbors: ExplainNode[]) =>
  call(user, '/api/explain', { method: 'POST', body: JSON.stringify({ node, neighbors }) }).then((r) =>
    json<{ explanation: string }>(r),
  );

export const neighborhood = (user: string, sourceId: string) =>
  call(user, `/api/graph/${encodeURIComponent(sourceId)}`).then((r) => json<Neighborhood>(r));

export const checkout = (user: string, product: 'pro' | 'credits') =>
  call(user, '/api/billing/checkout', { method: 'POST', body: JSON.stringify({ product }) }).then((r) =>
    json<{ checkoutUrl: string }>(r),
  );

export async function gsql(user: string, name: string): Promise<string> {
  const res = await call(user, `/api/gsql/${encodeURIComponent(name)}`);
  return res.ok ? res.text() : fail(res);
}

/** A free user gets `upgrade` with a checkout link instead of a zip. */
export async function exportVault(
  user: string,
): Promise<{ kind: 'zip'; blob: Blob } | { kind: 'upgrade'; checkoutUrl: string }> {
  const res = await call(user, '/api/export');
  if (res.status === 402) {
    const body = (await res.json().catch(() => null)) as { checkoutUrl?: string } | null;
    if (body?.checkoutUrl) return { kind: 'upgrade', checkoutUrl: body.checkoutUrl };
  }
  return res.ok ? { kind: 'zip', blob: await res.blob() } : fail(res);
}
