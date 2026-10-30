import { auth, clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { GraphPort } from '../graph/port';
import type { User } from '../types';
import { verifyExtensionToken } from './extension-token';

type Env = Record<string, string | undefined>;

/** Remembers a demo `?user=` across navigations, since dashboard links no longer carry it. */
export const DEMO_COOKIE = 'atlas-demo-user';

/** Local demos only. A production build or a Vercel production or preview deployment refuses it, whatever DEMO_MODE says. */
export function demoModeEnabled(env: Env = process.env): boolean {
  return env.DEMO_MODE === '1' && env.NODE_ENV !== 'production' && env.VERCEL_ENV !== 'production' && env.VERCEL_ENV !== 'preview';
}

/**
 * The one rule for caller-claimed ids (`x-user-id`, `?user=`, the demo cookie): null unless demo mode
 * is on. Everything else gets its identity from a Clerk session or a signed extension token.
 */
export function claimedUser(claims: (string | null | undefined)[], env: Env = process.env): string | null {
  if (!demoModeEnabled(env)) return null;
  return claims.map((c) => c?.trim()).find(Boolean) ?? null;
}

function demoCookie(request: Request): string | undefined {
  return request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=([^;]+)`))?.[1];
}

/** Who an API request is from. A bad bearer token never falls through to the session. */
export async function requestUser(request: Request): Promise<string | null> {
  const claim = claimedUser([request.headers.get('x-user-id'), demoCookie(request)]);
  if (claim) return claim;
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return verifyExtensionToken(bearer);
  return (await auth()).userId;
}

// Completion only ever goes from false to true, so a remembered true cannot go stale. It saves a Clerk API call per render.
const onboarded = new Set<string>();

export async function isOnboarded(userId: string): Promise<boolean> {
  if (onboarded.has(userId)) return true;
  const user = await (await clerkClient()).users.getUser(userId);
  if (user.publicMetadata.onboardingComplete !== true) return false;
  onboarded.add(userId);
  return true;
}

/** Marks setup done in `publicMetadata`, which only the server can write, along with any other fields. */
export async function completeOnboarding(userId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await (await clerkClient()).users.updateUserMetadata(userId, { publicMetadata: { ...metadata, onboardingComplete: true } });
  onboarded.add(userId);
}

/** Who a dashboard page is for. Signed-out users go to sign-in, and users who have not finished setup go to onboarding. */
export async function dashboardUser(param?: string | string[]): Promise<string> {
  const claim = claimedUser([Array.isArray(param) ? param[0] : param, (await cookies()).get(DEMO_COOKIE)?.value]);
  if (claim) return claim;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  if (!(await isOnboarded(userId))) redirect('/onboarding');
  return userId;
}

export function placeholderEmail(userId: string): string {
  return `${userId}@example.com`;
}

async function accountEmail(userId: string): Promise<string> {
  if (!userId.startsWith('user_')) return placeholderEmail(userId);
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return user.primaryEmailAddress?.emailAddress ?? placeholderEmail(userId);
  } catch {
    return placeholderEmail(userId);
  }
}

/** The graph user, created on first sight with the real Clerk email. Clerk is only asked once per account. */
export async function ensureAccount(graph: Pick<GraphPort, 'getUser' | 'ensureUser'>, userId: string): Promise<User> {
  return (await graph.getUser(userId)) ?? graph.ensureUser(userId, await accountEmail(userId));
}
