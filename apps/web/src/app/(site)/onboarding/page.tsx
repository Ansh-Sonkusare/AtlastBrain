import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isOnboarded } from '../../../server/auth/identity';
import { Onboarding } from './Onboarding';

export const metadata: Metadata = { title: 'Set up' };

async function Gate() {
  const { userId } = await auth();
  if (userId && (await isOnboarded(userId))) redirect('/dashboard');
  return <Onboarding />;
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}
