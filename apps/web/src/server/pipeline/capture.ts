import { createHash, randomUUID } from 'node:crypto';
import type { SourceRecord } from '../graph/port';
import type { CapturePayload, SourceStatus } from '../types';
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

export interface CaptureOptions {
  /** Runs only for a new source, before it is created. Returns its first status. Defaults to `pending`. */
  admit?: () => Promise<Extract<SourceStatus, 'pending' | 'blocked'>>;
}

/** The same selection on the same source gets the same id, so a repeat save adds no second highlight. */
function highlightId(sourceId: string, selection: string): string {
  return `hl-${createHash('sha256').update(`${sourceId}\n${selection}`).digest('hex').slice(0, 32)}`;
}

async function saveSelection(deps: Pick<PipelineDeps, 'graph' | 'now'>, source: SourceRecord, selection?: string) {
  const text = selection?.trim();
  if (!text) return;
  await deps.graph.addHighlight(source.userId, {
    id: highlightId(source.id, text),
    sourceId: source.id,
    text,
    createdAt: deps.now().toISOString(),
  });
}

export async function capture(
  deps: Pick<PipelineDeps, 'graph' | 'now'>,
  userId: string,
  payload: CaptureInput,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const now = deps.now();
  const rawUrl = payload.url?.trim();
  const url = rawUrl ? canonicalUrl(rawUrl) : `voice://${now.getTime()}`;
  const hash = contentHash(payload.text);

  const existing = await deps.graph.findSource(userId, url, hash);
  if (existing) {
    await saveSelection(deps, existing, payload.selection);
    return { source: existing, duplicate: true };
  }

  const status = (await options.admit?.()) ?? 'pending';
  const source: SourceRecord = {
    id: randomUUID(),
    userId,
    url,
    title: payload.title,
    kind: payload.source,
    status,
    savedAt: payload.capturedAt ?? now.toISOString(),
    readAt: null,
    contentHash: hash,
    body: payload.text,
    newRatio: 0,
    tldr: null,
  };
  await deps.graph.createSource(source);
  await saveSelection(deps, source, payload.selection);
  return { source, duplicate: false };
}
