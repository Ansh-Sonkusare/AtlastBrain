import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signExtensionToken } from './extension-token';
import { claimedUser, demoModeEnabled, ensureAccount, requestUser } from './identity';

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: clerk.userId }),
  clerkClient: async () => ({ users: { getUser: clerk.getUser } }),
}));

const req = (headers: Record<string, string> = {}) => new Request('http://x/api/me', { headers });

beforeEach(() => {
  clerk.userId = null;
  clerk.getUser.mockReset();
  vi.stubEnv('EXTENSION_TOKEN_SECRET', 's');
  vi.stubEnv('DEMO_MODE', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('demoModeEnabled', () => {
  it('is on only for DEMO_MODE=1 outside production', () => {
    expect(demoModeEnabled({ DEMO_MODE: '1', NODE_ENV: 'development' })).toBe(true);
    expect(demoModeEnabled({ DEMO_MODE: '1', NODE_ENV: 'test' })).toBe(true);
    expect(demoModeEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(demoModeEnabled({ DEMO_MODE: 'true', NODE_ENV: 'development' })).toBe(false);
  });

  it('refuses production and Vercel deployments even with DEMO_MODE=1', () => {
    expect(demoModeEnabled({ DEMO_MODE: '1', NODE_ENV: 'production' })).toBe(false);
    expect(demoModeEnabled({ DEMO_MODE: '1', NODE_ENV: 'development', VERCEL_ENV: 'production' })).toBe(false);
    expect(demoModeEnabled({ DEMO_MODE: '1', NODE_ENV: 'development', VERCEL_ENV: 'preview' })).toBe(false);
  });
});

describe('claimedUser', () => {
  it('honours nothing without demo mode', () => {
    expect(claimedUser(['demo'], { NODE_ENV: 'development' })).toBeNull();
    expect(claimedUser(['demo'], { DEMO_MODE: '1', NODE_ENV: 'production' })).toBeNull();
  });

  it('takes the first non-empty claim in demo mode', () => {
    expect(claimedUser([null, '  ', 'ann', 'bob'], { DEMO_MODE: '1', NODE_ENV: 'test' })).toBe('ann');
    expect(claimedUser([undefined, ''], { DEMO_MODE: '1', NODE_ENV: 'test' })).toBeNull();
  });
});

describe('requestUser', () => {
  it('ignores a spoofed x-user-id and demo cookie without demo mode', async () => {
    expect(await requestUser(req({ 'x-user-id': 'victim', cookie: 'atlas-demo-user=victim' }))).toBeNull();
    clerk.userId = 'user_me';
    expect(await requestUser(req({ 'x-user-id': 'victim' }))).toBe('user_me');
  });

  it('honours x-user-id and the demo cookie in demo mode', async () => {
    vi.stubEnv('DEMO_MODE', '1');
    expect(await requestUser(req({ 'x-user-id': 'demo' }))).toBe('demo');
    expect(await requestUser(req({ cookie: 'a=b; atlas-demo-user=ann; c=d' }))).toBe('ann');
    expect(await requestUser(req())).toBeNull();
  });

  it('accepts a valid extension token and never falls back to the session for a bad one', async () => {
    expect(await requestUser(req({ authorization: `Bearer ${signExtensionToken('user_ext')}` }))).toBe('user_ext');
    clerk.userId = 'user_me';
    expect(await requestUser(req({ authorization: 'Bearer user_ext.99999999999.forged' }))).toBeNull();
  });
});

describe('ensureAccount', () => {
  const graph = () => ({
    getUser: vi.fn(async () => null),
    ensureUser: vi.fn(async (id: string, email: string) => ({ id, email, plan: 'free' as const, credits: 0, dodoCustomerId: '' })),
  });

  it('creates a Clerk user with the real email', async () => {
    clerk.getUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'me@real.test' } });
    expect((await ensureAccount(graph(), 'user_1')).email).toBe('me@real.test');
  });

  it('falls back to a placeholder without asking Clerk for a non-Clerk id, and when Clerk fails', async () => {
    expect((await ensureAccount(graph(), 'demo')).email).toBe('demo@example.com');
    expect(clerk.getUser).not.toHaveBeenCalled();
    clerk.getUser.mockRejectedValue(new Error('down'));
    expect((await ensureAccount(graph(), 'user_2')).email).toBe('user_2@example.com');
  });
});
