import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { monthStart } from '../../server/billing/quota';
import { getDeps } from '../../server/deps';
import { PlanPanel } from './PlanPanel';
import { Ledger, PageLoading, Shell, statusLabel } from './Parts';
import {
  buildUsage,
  formatDate,
  hostOf,
  mergeLibrary,
  resolveUser,
  SOURCE_STATUSES,
  sourceHref,
  type LibraryItem,
} from './view-model';

export default function DashboardPage(props: PageProps<'/dashboard'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading your library…" />}>
      <Library searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Library({ searchParams }: { searchParams: PageProps<'/dashboard'>['searchParams'] }) {
  await connection();
  const user = resolveUser((await searchParams).user);
  const { graph, now } = await getDeps();
  const account = await graph.ensureUser(user, `${user}@example.com`);
  const [lists, projects, concepts, learnNext, used] = await Promise.all([
    Promise.all(SOURCE_STATUSES.map((s) => graph.listSourcesByStatus(user, s))),
    graph.listProjects(user),
    graph.listConcepts(user),
    graph.learnNext(user, 3),
    graph.countSavesSince(user, monthStart(now())),
  ]);
  const items = mergeLibrary(lists);
  const unread = items.filter((i) => !i.read && (i.status === 'done' || i.status === 'partial')).length;

  return (
    <Shell user={user} current="library">
      <div className="columns">
        <section className="stack" aria-labelledby="library-title">
          <div>
            <h1 id="library-title">Library</h1>
            <p className="muted">
              {items.length === 0
                ? 'Nothing saved yet.'
                : `${items.length} ${items.length === 1 ? 'save' : 'saves'}, ${unread} unread`}
            </p>
          </div>
          {items.length === 0 ? (
            <p className="empty">
              Save a page from the extension with Alt+S, or <Link href="/">paste one</Link>. What is new to you will show here.
            </p>
          ) : (
            <ul className="library">
              {items.map((item) => (
                <LibraryRow key={item.id} item={item} user={user} />
              ))}
            </ul>
          )}
        </section>

        <aside className="stack" aria-label="Context">
          <section className="panel" aria-labelledby="learn-title">
            <h2 id="learn-title">Learn next</h2>
            {learnNext.length === 0 ? (
              <p className="muted">Nothing queued. Concepts tied to your projects with unread saves appear here.</p>
            ) : (
              <ul className="learn">
                {learnNext.map((item) => (
                  <li key={item.concept}>
                    <p>
                      <strong>{item.concept}</strong> <span className="muted">for {item.project}</span>
                    </p>
                    <ul>
                      {item.unreadSources.map((s) => (
                        <li key={s.id}>
                          <Link href={sourceHref(user, s.id)}>{s.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="projects-title">
            <h2 id="projects-title">Projects</h2>
            {projects.length === 0 ? (
              <p className="muted">No projects yet.</p>
            ) : (
              <ul className="plain">
                {projects.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    {p.description && <p className="muted">{p.description}</p>}
                  </li>
                ))}
              </ul>
            )}
            <h2 id="concepts-title">Concepts</h2>
            {concepts.length === 0 ? (
              <p className="muted">Concepts show up as your saves are checked.</p>
            ) : (
              <ul className="chips" aria-labelledby="concepts-title">
                {concepts.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="plan-title">
            <h2 id="plan-title">Plan and usage</h2>
            <PlanPanel user={user} usage={buildUsage(account, used)} />
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function LibraryRow({ item, user }: { item: LibraryItem; user: string }) {
  const pending = statusLabel(item.status);
  const ratio = item.newRatio;
  return (
    <li className="row">
      <div className="row-main">
        <Link className="row-title" href={sourceHref(user, item.id)}>
          {item.title}
        </Link>
        <p className="muted">
          {hostOf(item.url) && <span>{hostOf(item.url)}</span>} <span>Saved {formatDate(item.savedAt)}</span>{' '}
          {!item.read && pending === null && <span className="unread">Unread</span>}
        </p>
      </div>
      <div className="row-ratio">
        {pending !== null || ratio === null ? (
          <span className={`chip ${item.status}`}>{pending}</span>
        ) : (
          <>
            <Ledger newPart={ratio} repeatPart={1 - ratio} label={`${item.percentNew}% new`} />
            <span className="pct">{item.percentNew}% new</span>
          </>
        )}
      </div>
    </li>
  );
}
