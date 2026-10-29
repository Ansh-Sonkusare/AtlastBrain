import type { Api } from './api';
import type { SaveResult } from './api-types';

export interface PollOptions {
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
  onUpdate?: (result: SaveResult) => void;
}

const FINISHED = new Set<SaveResult['status']>(['done', 'partial']);

/**
 * Polls a source until it is done or partial. A blocked source is reported
 * through onUpdate and polling continues, because the billing webhook moves it
 * back to pending once the plan allows the save. Returns null when aborted.
 */
export async function pollSource(
  api: Pick<Api, 'getSource'>,
  sourceId: string,
  { intervalMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), signal, onUpdate }: PollOptions = {},
): Promise<SaveResult | null> {
  while (!signal?.aborted) {
    const result = await api.getSource(sourceId);
    if (signal?.aborted) return null;
    onUpdate?.(result);
    if (FINISHED.has(result.status)) return result;
    await sleep(intervalMs);
  }
  return null;
}
