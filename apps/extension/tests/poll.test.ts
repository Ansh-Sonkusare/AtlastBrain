import { describe, expect, it, vi } from 'vitest';
import { createApi, type FetchLike } from '../lib/api';
import { pollSource } from '../lib/poll';
import type { SaveResult, SourceStatus } from '../lib/api-types';
import { jsonResponse, result } from './helpers';

function fakeFetch(statuses: SourceStatus[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let i = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const status = statuses[Math.min(i++, statuses.length - 1)];
    return jsonResponse(result({ status }));
  };
  return { fetchImpl, calls };
}

const settings = { apiBase: 'http://localhost:3000/', userId: 'demo' };

describe('pollSource', () => {
  it('polls until done, sleeping between polls', async () => {
    const { fetchImpl, calls } = fakeFetch(['pending', 'processing', 'done']);
    const sleep = vi.fn(async () => {});
    const seen: SaveResult['status'][] = [];
    const out = await pollSource(createApi(settings, fetchImpl), 's1', { sleep, intervalMs: 1000, onUpdate: (r) => seen.push(r.status) });
    expect(out?.status).toBe('done');
    expect(seen).toEqual(['pending', 'processing', 'done']);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(calls[0]!.url).toBe('http://localhost:3000/api/sources/s1');
    expect(calls[0]!.headers['x-user-id']).toBe('demo');
  });

  it('stops on partial', async () => {
    const { fetchImpl } = fakeFetch(['processing', 'partial']);
    const out = await pollSource(createApi(settings, fetchImpl), 's1', { sleep: async () => {} });
    expect(out?.status).toBe('partial');
  });

  it('keeps polling through blocked and finishes when the webhook flips the plan', async () => {
    const { fetchImpl, calls } = fakeFetch(['blocked', 'blocked', 'pending', 'done']);
    const seen: SaveResult['status'][] = [];
    const out = await pollSource(createApi(settings, fetchImpl), 's1', { sleep: async () => {}, onUpdate: (r) => seen.push(r.status) });
    expect(out?.status).toBe('done');
    expect(seen).toEqual(['blocked', 'blocked', 'pending', 'done']);
    expect(calls).toHaveLength(4);
  });

  it('returns null when aborted mid-poll', async () => {
    const { fetchImpl, calls } = fakeFetch(['pending']);
    const controller = new AbortController();
    const sleep = async () => controller.abort();
    const out = await pollSource(createApi(settings, fetchImpl), 's1', { sleep, signal: controller.signal });
    expect(out).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('surfaces the server error message', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ error: 'missing user' }, 401);
    await expect(pollSource(createApi(settings, fetchImpl), 's1')).rejects.toThrow('missing user');
  });
});

describe('createApi.capture', () => {
  it('posts the payload as JSON with the user header', async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    const fetchImpl: FetchLike = async (url, init) => {
      captured = { url, init };
      return jsonResponse({ sourceId: 's9', status: 'blocked', checkoutUrl: 'https://pay', reason: 'quota' }, 202);
    };
    const res = await createApi(settings, fetchImpl).capture({ url: 'voice://1', title: 'Voice note', text: 'hi', source: 'voice' });
    expect(res).toMatchObject({ status: 'blocked', checkoutUrl: 'https://pay' });
    expect(captured?.url).toBe('http://localhost:3000/api/capture');
    expect(captured?.init?.method).toBe('POST');
    expect(JSON.parse(String(captured?.init?.body))).toMatchObject({ source: 'voice', title: 'Voice note' });
    expect((captured?.init?.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});
