import { describe, expect, it } from 'vitest';
import { signExtensionToken, verifyExtensionToken } from './extension-token';

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

describe('extension token', () => {
  const token = signExtensionToken('user_abc', SECRET, NOW);

  it('has the userId.expiry.signature shape and verifies back to the user', () => {
    expect(token.split('.').slice(0, 2)).toEqual(['user_abc', String(NOW / 1000 + 90 * 86_400)]);
    expect(verifyExtensionToken(token, SECRET, NOW)).toBe('user_abc');
  });

  it('is good for 90 days and no longer', () => {
    expect(verifyExtensionToken(token, SECRET, NOW + 89 * DAY)).toBe('user_abc');
    expect(verifyExtensionToken(token, SECRET, NOW + 90 * DAY)).toBeNull();
  });

  it('rejects a changed user, a pushed-back expiry, a changed signature and another secret', () => {
    const [user, expiry, sig] = token.split('.') as [string, string, string];
    expect(verifyExtensionToken(`user_evil.${expiry}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyExtensionToken(`${user}.${Number(expiry) + 1}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyExtensionToken(`${user}.${expiry}.${sig.slice(0, -1)}x`, SECRET, NOW)).toBeNull();
    expect(verifyExtensionToken(`${user}.${expiry}.short`, SECRET, NOW)).toBeNull();
    expect(verifyExtensionToken(token, 'other-secret', NOW)).toBeNull();
  });

  it('rejects malformed tokens and fails closed with no secret', () => {
    for (const bad of ['', 'a', 'a.b', 'a.b.c.d', 'user.notanumber.sig']) expect(verifyExtensionToken(bad, SECRET, NOW)).toBeNull();
    expect(verifyExtensionToken(token, '', NOW)).toBeNull();
    expect(() => signExtensionToken('u', '')).toThrow('EXTENSION_TOKEN_SECRET');
  });
});
