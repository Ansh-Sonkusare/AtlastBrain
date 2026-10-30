import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_SECONDS = 90 * 24 * 60 * 60;

const signature = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

// ponytail: stateless token with no per-token revocation. Rotating EXTENSION_TOKEN_SECRET revokes every token at once. Add a token table if single-device revoke matters.
export function signExtensionToken(userId: string, secret = process.env.EXTENSION_TOKEN_SECRET, nowMs = Date.now()): string {
  if (!secret) throw new Error('EXTENSION_TOKEN_SECRET is not set');
  const payload = `${userId}.${Math.floor(nowMs / 1000) + TTL_SECONDS}`;
  return `${payload}.${signature(payload, secret)}`;
}

/** The user id the token was signed for, or null when it is forged, tampered with, malformed or expired. */
export function verifyExtensionToken(token: string, secret = process.env.EXTENSION_TOKEN_SECRET, nowMs = Date.now()): string | null {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiry, given] = parts as [string, string, string];
  if (!userId || !/^\d+$/.test(expiry)) return null;
  const expected = Buffer.from(signature(`${userId}.${expiry}`, secret));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return Number(expiry) * 1000 > nowMs ? userId : null;
}
