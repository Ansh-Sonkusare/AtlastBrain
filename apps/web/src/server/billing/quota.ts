import type { GraphPort } from '../graph/port';
import type { Plan } from '../types';

export type SaveDecision = 'allowed' | 'credit' | 'blocked';

export const ALLOWANCE: Record<Plan, number> = { free: 30, pro: 500 };

export function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Decides one save at capture time. Call it before the new source is created, so the
 * count holds only earlier saves. Over the allowance, a credit pays for the save.
 */
export async function decideSave(graph: GraphPort, userId: string, now: Date): Promise<SaveDecision> {
  const user = await graph.getUser(userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  const used = await graph.countSavesSince(userId, monthStart(now));
  if (used < ALLOWANCE[user.plan]) return 'allowed';
  if (user.credits > 0) {
    await graph.updateUser(userId, { credits: user.credits - 1 });
    return 'credit';
  }
  return 'blocked';
}

export function quotaFor(_graph: GraphPort): { allow(userId: string): Promise<boolean> } {
  return {
    // The gate lives at capture (decideSave) because a credit must be spent exactly once;
    // the worker can retry a source, and a second check there would charge it again.
    allow: async () => true,
  };
}
