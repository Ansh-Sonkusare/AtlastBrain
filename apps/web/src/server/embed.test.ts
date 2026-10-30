import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cosineDistance, embed } from './embed';

describe('embed', () => {
  it('returns normalised 384-dim vectors and ranks a paraphrase closer than an unrelated pair', async () => {
    const [a, b, c] = await embed([
      'The cat sat on the warm windowsill.',
      'A kitten was resting on the sunny window ledge.',
      'Quarterly tax filings are due next month.',
    ]);
    for (const v of [a!, b!, c!]) {
      expect(v).toHaveLength(384);
      expect(Math.hypot(...v)).toBeCloseTo(1, 4);
    }
    expect(cosineDistance(a!, a!)).toBeCloseTo(0, 5);
    expect(cosineDistance(a!, b!)).toBeLessThan(cosineDistance(a!, c!));
  });

  it('returns nothing for no input', async () => {
    expect(await embed([])).toEqual([]);
  });
});

describe('embed hf provider (stubbed fetch)', () => {
  const vec = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 3 : 4 * (i === 1 ? 1 : 0)));
  const ok = (rows: number[][]) => new Response(JSON.stringify(rows), { status: 200 });
  beforeEach(() => {
    vi.stubEnv('EMBED_PROVIDER', 'hf');
    vi.stubEnv('HF_TOKEN', 'hf_test');
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('normalises and batches', async () => {
    const f = vi.fn(async () => ok([vec(384)]));
    vi.stubGlobal('fetch', f);
    const [v] = await embed(['a']);
    expect(v).toHaveLength(384);
    expect(Math.hypot(...v!)).toBeCloseTo(1, 6);
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]![0]).toContain('router.huggingface.co');
    expect((calls[0]![1].headers as Record<string, string>).Authorization).toBe('Bearer hf_test');
  });

  it('retries once on 503 then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response('loading', { status: 503 })).mockResolvedValueOnce(ok([vec(384)]));
    vi.stubGlobal('fetch', f);
    const p = embed(['a']);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws on other errors without leaking the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const err = await embed(['a']).catch((e: Error) => e);
    expect((err as Error).message).toContain('401');
    expect((err as Error).message).not.toContain('hf_test');
  });

  it('rejects wrong dimensions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok([vec(10)])));
    await expect(embed(['a'])).rejects.toThrow(/384/);
  });
});
