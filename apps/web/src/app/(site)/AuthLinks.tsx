'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';

export function AuthLinks() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Link href="/dashboard" className="cta">Open dashboard</Link>;
  return (
    <>
      <Link href="/sign-in" className="link">Sign in</Link>
      <Link href="/signup" className="cta">Get started</Link>
    </>
  );
}
