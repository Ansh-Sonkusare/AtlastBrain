import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { dashboardUser } from '../../../../server/auth/identity';
import { getDeps } from '../../../../server/deps';
import { getSourceResponse } from '../../../../server/pipeline/result';
import { AutoRefresh } from '../../AutoRefresh';
import { GraphView } from '../../GraphView';
import { Icon, Ledger, PageLoading, Shell, statusLabel } from '../../Parts';
import { ShowQuery } from '../../ShowQuery';
import { buildSourceDetail, dashboardHref, formatDate, hostOf, projectsOfSource, sourceHref, type SourceDetail } from '../../view-model';

type Props = PageProps<'/dashboard/source/[id]'>;

export default function SourcePage(props: Props) {
  return (
    <Suspense fallback={<PageLoading label="Loading this save…" />}>
      <Source params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Source({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await dashboardUser(sp.user);
  const deps = await getDeps();
  const [res, record, exp] = await Promise.all([
    getSourceResponse(deps, user, id).catch(() => null),
    deps.graph.getSource(user, id),
    deps.graph.exportGraph(user).catch(() => null),
  ]);
  if (!res || !record) notFound();
  const d = buildSourceDetail(res);
  const waiting = statusLabel(d.status);
  const projects = exp ? projectsOfSource(exp, id) : [];
  const host = hostOf(d.url) || d.url;

  return (
    <Shell
      user={user}
      current="library"
      narrow
      crumbs={
        <>
          <Link href={dashboardHref('/library')}>Library</Link>
          <span className="here">{d.title}</span>
        </>
      }
      actions={
        <Link className="button primary" href={dashboardHref('/ask')}>
          <Icon name="ask" size={14} />
          Ask about your saves
        </Link>
      }
    >
      <article className="stack" style={{ gap: 40 }}>
        <header className="src-head">
          <span className="src-glyph rise" aria-hidden="true">
            {host.charAt(0) || 'a'}
          </span>
          <h1 className="source-title rise d1">{d.title}</h1>
          <dl className="props rise d2">
            <div className="prop">
              <dt>Source</dt>
              <dd>
                <a href={d.url} target="_blank" rel="noreferrer">
                  {host}
                </a>
              </dd>
            </div>
            <div className="prop">
              <dt>Saved</dt>
              <dd>
                {formatDate(record.savedAt)} · {record.readAt ? `read ${formatDate(record.readAt)}` : 'unread'}
              </dd>
            </div>
            {projects.length > 0 && (
              <div className="prop">
                <dt>Project</dt>
                <dd>
                  {projects.map((p) => (
                    <span key={p.name} className="chip">
                      <span className="sq" style={{ background: p.color }} />
                      {p.name}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {waiting === null && d.percentNew !== null && (
              <div className="prop">
                <dt>Novelty</dt>
                <dd className="novelty">
                  <span className="mono-sm" style={{ color: 'var(--new)', fontSize: 14 }}>
                    {d.percentNew}%
                  </span>
                  <Ledger newPart={d.newCount} repeatPart={d.repeatCount} label={`${d.newCount} new, ${d.repeatCount} already known`} />
                  <span className="muted">
                    {d.newCount} new · {d.repeatCount} known
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </header>
        <hr className="rule" />

        {waiting !== null ? (
          <Waiting status={d.status} />
        ) : (
          <>
            {d.status === 'partial' && <p className="status warn">Only part of this page could be checked.</p>}
            {d.tldr && (
              <section className="tldr-box rise d3" aria-labelledby="tldr-title">
                <h2 id="tldr-title">What&apos;s new, in short</h2>
                <ul>
                  {d.tldr.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {d.tldr.whyItMatters && (
                  <p className="why">
                    <b>Why it matters.</b> {d.tldr.whyItMatters}
                  </p>
                )}
              </section>
            )}
            <Claims d={d} />
            <hr className="rule" />
            <section className="connect">
              <div>
                <h2 className="label">Where it connects</h2>
                <GraphView sourceId={d.id} height={180} />
                <p className="muted">
                  <Link href={dashboardHref('/graph')}>Open full graph</Link>
                </p>
                <ShowQuery />
              </div>
              {d.highlights.length > 0 && (
                <div>
                  <h2 className="label">Your highlights</h2>
                  {d.highlights.map((h) => (
                    <blockquote key={h}>{h}</blockquote>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </article>
    </Shell>
  );
}

function Waiting({ status }: { status: SourceDetail['status'] }) {
  if (status === 'blocked')
    return (
      <p className="status warn">
        This save went over the free limit, so it has not been checked. Upgrade or add credits in the{' '}
        <Link href={dashboardHref('/library')}>library</Link>, and it will be checked on its own.
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

function Claims({ d }: { d: SourceDetail }) {
  if (d.newCount + d.repeatCount === 0) return <p className="empty">No claims were found on this page.</p>;
  return (
    <>
      <section className="claim-sec rise d4" aria-labelledby="new-title">
        <h2 id="new-title">
          New to you <span className="count new">{d.newCount}</span>
        </h2>
        {d.newCount === 0 && <p className="muted">Nothing new here. You had all of it already.</p>}
        <ul className="claims stagger">
          {d.newClaims.map((c) => (
            <li key={c.id} className="new-line">
              <span className="bullet" aria-hidden="true" />
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      </section>
      {d.repeatCount > 0 && (
        <section className="claim-sec" aria-labelledby="known-title">
          <details>
            <summary className="known-sum">
              <h2 id="known-title">Already known</h2>
              <span className="count mono-sm" style={{ fontSize: 14 }}>
                {d.repeatCount}
              </span>
              <span className="fold">
                <span className="when-closed">Show</span>
                <span className="when-open">Fold</span>
              </span>
            </summary>
            <ul className="claims known-list stagger">
              {d.repeats.map((r) => (
                <li key={`${r.sourceId}:${r.text}`} className="claim repeat">
                  <p>{r.text}</p>
                  <p className="claim-meta">
                    First read in <Link href={sourceHref(r.sourceId)}>{r.sourceTitle}</Link>
                    {r.originalText !== r.text && <span className="original">Original: {r.originalText}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}
