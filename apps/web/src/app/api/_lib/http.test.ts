import { afterEach, describe, expect, it, vi } from 'vitest';
import { withUser } from './http';

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: clerk.userId }), clerkClient: async () => ({}) }));
vi.mock('../../../server/deps', () => ({ getDeps: async () => ({}) }));

const whoami = withUser(async ({ userId }) => Response.json({ userId }));
const get = (headers: Record<string, string> = {}) => whoami(new Request('http://x/api/me', { headers }));

afterEach(() => {
  clerk.userId = null;
  vi.unstubAllEnvs();
});

describe('withUser', () => {
  it('answers JSON 401 to a spoofed x-user-id without demo mode', async () => {
    const res = await get({ 'x-user-id': 'victim' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'missing user' });
  });

  it('uses the Clerk session over a claimed id', async () => {
    clerk.userId = 'user_me';
    expect(await (await get({ 'x-user-id': 'victim' })).json()).toEqual({ userId: 'user_me' });
  });

  it('honours x-user-id with DEMO_MODE=1, but not when production refuses demo mode', async () => {
    vi.stubEnv('DEMO_MODE', '1');
    expect(await (await get({ 'x-user-id': 'demo' })).json()).toEqual({ userId: 'demo' });
    vi.stubEnv('NODE_ENV', 'production');
    expect((await get({ 'x-user-id': 'demo' })).status).toBe(401);
  });
});
