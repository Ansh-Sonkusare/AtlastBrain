'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-renders the server page every few seconds while a save is still being checked. */
export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
