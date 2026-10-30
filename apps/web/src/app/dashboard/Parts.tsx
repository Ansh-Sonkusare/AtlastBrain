import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SourceStatus } from '../../server/types';
import { dashboardHref } from './view-model';

export type NavKey = 'new' | 'library' | 'graph' | 'ask';

export function Shell({ user, current, full = false, children }: { user: string; current: NavKey; full?: boolean; children: ReactNode }) {
  const link = (key: NavKey, path: string, label: string) => (
    <Link href={dashboardHref(user, path)} aria-current={current === key ? 'page' : undefined}>
      {label}
    </Link>
  );
  return (
    <>
      <header className="topbar">
        <Link className="brand" href={dashboardHref(user)}>
          Second Brain
        </Link>
        <nav aria-label="Dashboard">
          {link('new', '', "What's new")}
          {link('library', '/library', 'Library')}
          {link('graph', '/graph', 'Graph')}
          {link('ask', '/ask', 'Ask')}
        </nav>
        <span className="who">{user}</span>
      </header>
      <main className={full ? 'page full' : 'page'}>{children}</main>
    </>
  );
}

/** Skeleton of the page shape while the server streams it in; the label is for screen readers. */
export function PageLoading({ label }: { label: string }) {
  return (
    <>
      <header className="topbar" aria-hidden="true">
        <span className="brand">Second Brain</span>
        <span className="skeleton-line" style={{ width: '16rem', height: 28 }} />
      </header>
      <main className="page">
        <p className="visually-hidden" role="status">
          {label}
        </p>
        <div className="columns" aria-hidden="true">
          <div className="stack">
            <span className="skeleton-line" style={{ width: '8rem' }} />
            <span className="skeleton-line" style={{ width: '70%', height: 40 }} />
            <span className="skeleton-line" style={{ width: '50%' }} />
            <div className="skeleton" style={{ height: 220 }} />
            <div className="skeleton" style={{ height: 180 }} />
          </div>
          <div className="stack">
            <div className="skeleton" style={{ height: 260 }} />
            <div className="skeleton" style={{ height: 140 }} />
          </div>
        </div>
      </main>
    </>
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
