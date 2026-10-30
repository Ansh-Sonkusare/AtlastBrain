import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDeps } from '../../server/deps';
import type { SourceStatus } from '../../server/types';
import { APP_NAME } from '../brand';
import { AccountName } from './AccountName';
import { dashboardHref, isChecked, mergeLibrary, SOURCE_STATUSES, sourceHref } from './view-model';

export type NavKey = 'new' | 'library' | 'graph' | 'ask';

const ICONS = {
  brief: (
    <>
      <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" />
      <path d="M18 8h2v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h3" />
    </>
  ),
  library: <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />,
  graph: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  ask: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  chev: <path d="m9 6 6 6-6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
} satisfies Record<string, ReactNode>;

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="4" cy="4.5" r="2" fill="#090807" />
        <circle cx="10.5" cy="4" r="1.5" fill="#090807" />
        <circle cx="7" cy="10" r="2.3" fill="none" stroke="#090807" strokeWidth="1.3" />
      </svg>
    </span>
  );
}

/** Saves for the sidebar. A graph hiccup should never take the whole page down, so it degrades to nothing. */
async function sidebarData(user: string) {
  try {
    const { graph } = await getDeps();
    const items = mergeLibrary(await Promise.all(SOURCE_STATUSES.map((s) => graph.listSourcesByStatus(user, s))));
    return { total: items.length, waiting: items.filter((i) => !isChecked(i.status)).length, recent: items.slice(0, 3) };
  } catch {
    return null;
  }
}

/**
 * Sidebar + main. `crumbs` and `actions` fill the top bar; `full` gives the main area to a canvas
 * and drops the top bar.
 */
export async function Shell({
  user,
  current,
  full = false,
  narrow = false,
  crumbs,
  actions,
  children,
}: {
  user: string;
  current: NavKey;
  full?: boolean;
  narrow?: boolean;
  crumbs?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const side = await sidebarData(user);
  const link = (key: NavKey, path: string, label: string, icon: keyof typeof ICONS, count?: number) => (
    <Link className="navlink" href={dashboardHref(path)} aria-current={current === key ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {count !== undefined && <span className="count">{count}</span>}
    </Link>
  );
  return (
    <div className="shell">
      <nav className="side fade" aria-label="Dashboard">
        <Link className="side-brand" href={dashboardHref()}>
          <Logo />
          <span className="brand-name">{APP_NAME}</span>
        </Link>
        <Link className="searchlink" href={dashboardHref('/ask')}>
          <Icon name="search" size={15} />
          Ask your brain
        </Link>
        <div className="nav-list">
          {link('new', '', "Today's brief", 'brief')}
          {link('library', '/library', 'Library', 'library', side?.total)}
          {link('graph', '/graph', 'Graph', 'graph')}
          {link('ask', '/ask', 'Ask', 'ask')}
        </div>
        {side && side.recent.length > 0 && (
          <div className="nav-list">
            <p className="side-label">Recent</p>
            {side.recent.map((r) => (
              <Link key={r.id} className="recent" href={sourceHref(r.id)}>
                <span>{r.title}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="side-foot">
          <span>Signed in as</span>
          <AccountName fallback={user} />
          {side && side.waiting > 0 && <span>{side.waiting} waiting to be checked</span>}
        </div>
      </nav>
      <main className={full ? 'main full' : 'main'}>
        {!full && (crumbs || actions) && (
          <div className="topbar">
            <div className="crumbs">{crumbs}</div>
            <div className="actions">{actions}</div>
          </div>
        )}
        {full ? children : <div className={narrow ? 'page narrow' : 'page'}>{children}</div>}
      </main>
    </div>
  );
}

/** Skeleton of the page shape while the server streams it in; the label is for screen readers. */
export function PageLoading({ label }: { label: string }) {
  return (
    <div className="shell">
      <nav className="side" aria-hidden="true">
        <span className="side-brand">
          <Logo />
          <span className="brand-name">{APP_NAME}</span>
        </span>
      </nav>
      <main className="main">
        <div className="page">
          <p className="visually-hidden" role="status">
            {label}
          </p>
          <div className="stack" aria-hidden="true">
            <span className="skeleton-line" style={{ width: '8rem' }} />
            <span className="skeleton-line" style={{ width: '70%', height: 40 }} />
            <span className="skeleton-line" style={{ width: '50%' }} />
            <div className="skeleton" style={{ height: 220 }} />
            <div className="skeleton" style={{ height: 180 }} />
          </div>
        </div>
      </main>
    </div>
  );
}

/** New vs repeated at a glance: an amber bar is new to you, a warm grey bar is something you already had. */
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
