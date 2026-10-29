import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDeps } from '../../../../server/deps';
import { getSourceResponse } from '../../../../server/pipeline/result';
import { AutoRefresh } from '../../AutoRefresh';
import { GraphView } from '../../GraphView';
import { Ledger, PageLoading, Shell, statusLabel } from '../../Parts';
import { ShowQuery } from '../../ShowQuery';
import { buildSourceDetail, dashboardHref, formatDate, hostOf, resolveUser, sourceHref, type SourceDetail } from '../../view-model';

type Props = PageProps<'/dashboard/source/[id]'>;

export default function SourcePage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Loading this save…" />}>
      <Source params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Source({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = resolveUser(sp.user);
  const deps = await getDeps();
  const [res, record] = await Promise.all([
    getSourceResponse(deps, user, id).catch(() => null),
    deps.graph.getSource(user, id),
  ]);
  if (!res || !record) notFound();
  const d = buildSourceDetail(res);
  const waiting = statusLabel(d.status);

  return (
    <Shell user={user} current="source">
      <article className="stack wide">
        <p>
          <Link href={dashboardHref(user)}>Library</Link>
        </p>
        <header className="stack">
          <h1>{d.title}</h1>
          <p className="muted">
            <a href={d.url} target="_blank" rel="noreferrer">
              {hostOf(d.url) || d.url}
            </a>{' '}
            <span>Saved {formatDate(record.savedAt)}</span>{' '}
            <span>{record.readAt ? `Read ${formatDate(record.readAt)}` : 'Unread'}</span>
          </p>
        </header>

        {waiting !== null ? <Waiting status={d.status} user={user} /> : <Verdict d={d} />}

        {waiting === null && (
          <>
            {d.status === 'partial' && <p className="status warn">Only part of this page could be checked.</p>}
            {d.tldr && (
              <section className="panel" aria-labelledby="tldr-title">
                <h2 id="tldr-title">TL;DR</h2>
                <ul>
                  {d.tldr.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {d.tldr.whyItMatters && (
                  <p>
                    <strong>Why it matters.</strong> {d.tldr.whyItMatters}
                  </p>
                )}
              </section>
            )}
            <Claims d={d} user={user} />
            {d.highlights.length > 0 && (
              <section className="stack" aria-labelledby="hl-title">
                <h2 id="hl-title">Your highlights</h2>
                {d.highlights.map((h) => (
                  <blockquote key={h}>{h}</blockquote>
                ))}
              </section>
            )}
            <section className="stack" aria-labelledby="graph-title">
              <h2 id="graph-title">Neighborhood</h2>
              <GraphView user={user} sourceId={d.id} />
              <ShowQuery user={user} />
            </section>
          </>
        )}
      </article>
    </Shell>
  );
}

function Waiting({ status, user }: { status: SourceDetail["status"]; user: string }) {
  if (status === 'blocked')
    return (
      <p className="status warn">
        This save went over the free limit, so it has not been checked. Upgrade or add credits in the{' '}
        <Link href={dashboardHref(user)}>dashboard</Link>, and it will be checked on its own.
      </p>
    );
  return (
    <>
      <AutoRefresh />
      <p className="status" role="status">
        Checking this page against everything you have read. This updates on its own.
      </p>
    </>
  );
}

function Verdict({ d }: { d: SourceDetail }) {
  return (
    <section className="verdict" aria-label="New versus repeated">
      <Ledger newPart={d.newCount} repeatPart={d.repeatCount} size="lg" label={`${d.newCount} new claims, ${d.repeatCount} repeated`} />
      <dl className="tally">
        <div className="new">
          <dd>{d.newCount}</dd>
          <dt>new to you</dt>
        </div>
        <div className="repeat">
          <dd>{d.repeatCount}</dd>
          <dt>already known</dt>
        </div>
        <div>
          <dd>{d.percentNew}%</dd>
          <dt>new ratio</dt>
        </div>
      </dl>
    </section>
  );
}

function Claims({ d, user }: { d: SourceDetail; user: string }) {
  if (d.newCount + d.repeatCount === 0) return <p className="empty">No claims were found on this page.</p>;
  return (
    <section className="stack" aria-labelledby="claims-title">
      <h2 id="claims-title">Claims</h2>
      <ul className="claims">
        {d.newClaims.map((c) => (
          <li key={c.id} className="claim new">
            <p>{c.text}</p>
            <p className="claim-meta">New to you</p>
          </li>
        ))}
        {d.repeats.map((r) => (
          <li key={`${r.sourceId}:${r.text}`} className="claim repeat">
            <p>{r.text}</p>
            <p className="claim-meta">
              Already known. First seen in <Link href={sourceHref(user, r.sourceId)}>{r.sourceTitle}</Link>
              {r.originalText !== r.text && <span className="original">Original: {r.originalText}</span>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
