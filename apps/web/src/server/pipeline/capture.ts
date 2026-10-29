import { createHash, randomUUID } from 'node:crypto';
import type { SourceRecord } from '../graph/port';
import type { CapturePayload } from '../types';
import type { PipelineDeps } from './deps';

export type CaptureInput = Omit<CapturePayload, 'url'> & { url?: string };

export interface CaptureResult {
  source: SourceRecord;
  duplicate: boolean;
}

export function canonicalUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  if (url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '');
  const out = url.toString();
  return out.endsWith('/') || out.endsWith('?') ? out.slice(0, -1) : out;
}

export function contentHash(text: string): string {
  const normalised = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalised).digest('hex');
}

export async function capture(
  deps: Pick<PipelineDeps, 'graph' | 'now'>,
  userId: string,
  payload: CaptureInput,
): Promise<CaptureResult> {
  const now = deps.now();
  const rawUrl = payload.url?.trim();
  const url = rawUrl ? canonicalUrl(rawUrl) : `voice://${now.getTime()}`;
  const hash = contentHash(payload.text);

  const existing = await deps.graph.findSource(userId, url, hash);
  if (existing) return { source: existing, duplicate: true };

  const source: SourceRecord = {
    id: randomUUID(),
    userId,
    url,
    title: payload.title,
    kind: payload.source,
    status: 'pending',
    savedAt: payload.capturedAt ?? now.toISOString(),
    readAt: null,
    contentHash: hash,
    body: payload.text,
    newRatio: 0,
    tldr: null,
  };
  await deps.graph.createSource(source);
  return { source, duplicate: false };
}
