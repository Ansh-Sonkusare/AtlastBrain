'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { completeOnboarding } from '../../../server/auth/identity';
import { saveProjects } from '../../../server/brain/projects';
import { getGraph } from '../../../server/deps';
import { embed } from '../../../server/embed';

const Setup = z.object({
  projects: z.array(z.string().trim().min(1).max(120)).max(20),
  schedule: z.enum(['am', 'pm', 'wk']),
});

/** Saves the chosen projects and schedule, then marks setup done. Returns an error to show, or null. */
export async function finishSetup(projects: string[], schedule: string): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return 'Your session ended. Sign in again.';
  const parsed = Setup.safeParse({ projects, schedule });
  if (!parsed.success) return 'Project names must be 120 characters or fewer, and you can add up to 20.';
  await saveProjects(await getGraph(), embed, userId, parsed.data.projects);
  await completeOnboarding(userId, { briefSchedule: parsed.data.schedule });
  return null;
}

export async function skipSetup(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  await completeOnboarding(userId);
  redirect('/dashboard');
}
