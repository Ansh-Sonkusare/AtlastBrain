import { afterEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, type TigerGraphConfig } from './tigergraph';

const config = (over: Partial<TigerGraphConfig> = {}): TigerGraphConfig => ({ url: 'https://a.test', graph: 'G', user: 'u', password: 'p', ...over });

describe('authHeaders', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends nothing when there is no secret', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await authHeaders(config())).toEqual({});
    expect(f).not.toHaveBeenCalled();
  });

  it('mints one token and reuses it until near expiry', async () => {
    const expiration = new Date(Date.now() + 7 * 86_400_000).toUTCString();
    const f = vi.fn(async () => new Response(JSON.stringify({ token: 'jwt', expiration })));
    vi.stubGlobal('fetch', f);
    const c = config({ url: 'https://b.test', secret: 's' });
    expect(await authHeaders(c)).toEqual({ Authorization: 'Bearer jwt' });
    await authHeaders(c);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the secret is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: true }), { status: 401 })));
    await expect(authHeaders(config({ url: 'https://c.test', secret: 'bad' }))).rejects.toThrow('HTTP 401');
  });
});
