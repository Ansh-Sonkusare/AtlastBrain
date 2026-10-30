'use server';

import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { signExtensionToken } from '../../../../server/auth/extension-token';
import { claimedUser, DEMO_COOKIE } from '../../../../server/auth/identity';

export async function mintExtensionToken(): Promise<{ token: string } | { error: string }> {
  const userId = claimedUser([(await cookies()).get(DEMO_COOKIE)?.value]) ?? (await auth()).userId;
  if (!userId) return { error: 'Your session ended. Sign in again.' };
  try {
    return { token: signExtensionToken(userId) };
  } catch {
    return { error: 'Extension connections are not set up on this server.' };
  }
}
