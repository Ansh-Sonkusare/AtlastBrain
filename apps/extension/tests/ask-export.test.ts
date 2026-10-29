import { describe, expect, it } from 'vitest';
import { createApi, type FetchLike } from '../lib/api';
import { buildAnswerView, buildNewToMeView } from '../lib/view-model';
import { jsonResponse, result } from './helpers';

const settings = { apiBase: 'http://x/', userId: 'u1' };
const claim = (id: string, title: string) => ({
  claimId: id, claimText: `claim ${id}`, distance: 0.1, sourceId: `s-${id}`, sourceTitle: title, sourceUrl: `https://e/${id}`, concepts: [],
});

describe('buildAnswerView', () => {
  it('lists each cited claim once, in order, with its page', () => {
    const view = buildAnswerView({ question: 'q', answer: ' Because. ', citations: [claim('b', 'B'), claim('a', 'A'), claim('b', 'B')] });
    expect(view.answer).toBe('Because.');
    expect(view.citations).toEqual([
      { claimId: 'b', text: 'claim b', sourceTitle: 'B', sourceUrl: 'https://e/b' },
      { claimId: 'a', text: 'claim a', sourceTitle: 'A', sourceUrl: 'https://e/a' },
    ]);
  });
});

describe('highlights in the view', () => {
  it('passes the highlights through, empty when absent', () => {
    expect(buildNewToMeView(result({ highlights: ['q1'] })).highlights).toEqual(['q1']);
    expect(buildNewToMeView(result()).highlights).toEqual([]);
  });
});

describe('api: ask, export, delete, gsql', () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const api = (respond: () => Response) =>
    createApi(settings, (async (url, init) => { calls.push({ url, init }); return respond(); }) as FetchLike);

  it('posts the question with the user header', async () => {
    calls.length = 0;
    const res = await api(() => jsonResponse({ question: 'q', answer: 'a', citations: [] })).ask('q');
    expect(res.answer).toBe('a');
    expect(calls[0]!.url).toBe('http://x/api/ask');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.init?.body).toBe(JSON.stringify({ question: 'q' }));
    expect((calls[0]!.init?.headers as Record<string, string>)['x-user-id']).toBe('u1');
  });

  it('returns the zip for a Pro user', async () => {
    const out = await api(() => new Response(new Blob(['PK'], { type: 'application/zip' }))).exportVault();
    expect(out.kind).toBe('zip');
  });

  it('returns the checkout link when the export is 402', async () => {
    const out = await api(() => jsonResponse({ error: 'Pro only', checkoutUrl: 'https://pay/1' }, 402)).exportVault();
    expect(out).toEqual({ kind: 'upgrade', checkoutUrl: 'https://pay/1' });
  });

  it('throws on other export errors', async () => {
    await expect(api(() => jsonResponse({ error: 'boom' }, 500)).exportVault()).rejects.toThrow('boom');
  });

  it('sends DELETE /api/me and accepts 204', async () => {
    calls.length = 0;
    await api(() => new Response(null, { status: 204 })).deleteMe();
    expect(calls[0]!.url).toBe('http://x/api/me');
    expect(calls[0]!.init?.method).toBe('DELETE');
  });

  it('reads the gsql text, and fails on 404', async () => {
    expect(await api(() => new Response('CREATE QUERY known_claims() {}')).gsql('known_claims')).toContain('known_claims');
    await expect(api(() => jsonResponse({ error: 'unknown query' }, 404)).gsql('nope')).rejects.toThrow('unknown query');
  });
});
