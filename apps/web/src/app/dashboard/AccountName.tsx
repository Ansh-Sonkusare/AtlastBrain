'use client';

import { UserButton, useUser } from '@clerk/nextjs';

/** The real name and account menu (with sign out). `fallback` is a demo-mode id, where there is no Clerk session. */
export function AccountName({ fallback }: { fallback: string }) {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return <div className="account" />;
  return (
    <div className="account">
      {user && <UserButton />}
      <strong>{user ? user.fullName || user.primaryEmailAddress?.emailAddress || 'Your account' : fallback}</strong>
    </div>
  );
}
