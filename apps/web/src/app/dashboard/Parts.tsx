import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SourceStatus } from '../../server/types';
import { dashboardHref } from './view-model';

export function Shell({ user, current, children }: { user: string; current: 'library' | 'ask' | 'source'; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link className="brand" href={dashboardHref(user)}>
          Second Brain
        </Link>
        <nav aria-label="Dashboard">
          <Link href={dashboardHref(user)} aria-current={current === 'library' ? 'page' : undefined}>
            Library
          </Link>
          <Link href={dashboardHref(user, '/ask')} aria-current={current === 'ask' ? 'page' : undefined}>
            Ask
          </Link>
        </nav>
        <span className="who">{user}</span>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export function PageLoading({ label }: { label: string }) {
  return (
    <main className="page">
      <p className="status" role="status">
        {label}
      </p>
    </main>
  );
}

/**
 * New vs repeated at a glance: solid green is new to you, hatched grey is something you
 * already had. The two parts only need to be proportional.
 */
export function Ledger({ newPart, repeatPart, label, size = 'sm' }: { newPart: number; repeatPart: number; label: string; size?: 'sm' | 'lg' }) {
  const empty = newPart + repeatPart === 0;
  return (
    <div className={`ledger ${size}`} role="img" aria-label={label}>
      {empty ? (
        <span className="seg empty" style={{ flexGrow: 1 }} />
      ) : (
        <>
          {newPart > 0 && <span className="seg new" style={{ flexGrow: newPart }} />}
          {repeatPart > 0 && <span className="seg repeat" style={{ flexGrow: repeatPart }} />}
        </>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Exclude<SourceStatus, 'done' | 'partial'>, string> = {
  pending: 'Waiting',
  processing: 'Checking',
  blocked: 'Over free limit',
};

export const statusLabel = (status: SourceStatus) => (status === 'done' || status === 'partial' ? null : STATUS_LABEL[status]);
