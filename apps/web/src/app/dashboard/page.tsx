import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { dashboardUser, ensureAccount } from '../../server/auth/identity';
import { getDeps } from '../../server/deps';
import { getSourceResponse } from '../../server/pipeline/result';
import { buildForceData, buildWholeGraph, filterForceData, type NodeGroup } from './graph-model';
import { GraphPreview } from './GraphPreview';
import { Icon, Ledger, PageLoading, Shell } from './Parts';
import {
  buildDailyDigest,
  buildSourceDetail,
  dashboardHref,
  formatDate,
  formatDay,
  hostOf,
  isChecked,
  mergeLibrary,
  projectColor,
  projectCoverage,
  projectsOfSource,
  SOURCE_STATUSES,
  sourceHref,
  type DigestDay,
  type SourceDetail,
} from './view-model';

const SHOWN_DAYS = 5;
const MAX_SAVES = 24;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function TodaysBriefPage(props: PageProps<'/dashboard'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading today's brief…" />}>
      <TodaysBrief searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TodaysBrief({ searchParams }: { searchParams: PageProps<'/dashboard'>['searchParams'] }) {
  await connection();
  const user = await dashboardUser((await searchParams).user);
  const deps = await getDeps();
  const { graph } = deps;
  await ensureAccount(graph, user);
  const [lists, learnNext, exp] = await Promise.all([
    Promise.all(SOURCE_STATUSES.map((s) => graph.listSourcesByStatus(user, s))),
    graph.learnNext(user, 3),
    graph.exportGraph(user),
  ]);
  const items = mergeLibrary(lists);
  const checkedItems = items.filter((i) => isChecked(i.status));
  const waiting = items.length - checkedItems.length;
  const recentDays = [...new Set(checkedItems.map((i) => i.savedAt.slice(0, 10)))].slice(0, SHOWN_DAYS);
  const recent = checkedItems.filter((i) => recentDays.includes(i.savedAt.slice(0, 10))).slice(0, MAX_SAVES);
  const loaded = (
    await Promise.all(
      recent.map((i) =>
        getSourceResponse(deps, user, i.id).then(
          (res) => ({ detail: buildSourceDetail(res), savedAt: i.savedAt }),
          () => null,
        ),
      ),
    )
  ).filter((x) => x !== null);
  const days = buildDailyDigest(loaded);
  const latest = days[0];
  const latestSaves = latest ? loaded.filter((l) => l.savedAt.startsWith(latest.day)).map((l) => ({ ...l.detail, savedAt: l.savedAt })) : [];
  const withNew = latestSaves.filter((d) => d.newCount > 0);
  const leftOut = latestSaves.filter((d) => d.newCount === 0);

  const coverage = projectCoverage(exp);
  const claimCount = exp.sources.reduce((n, s) => n + s.made.length, 0);
  const preview = filterForceData(buildForceData(buildWholeGraph(exp), ''), new Set<NodeGroup>(['New', 'Known', 'Source']));
  // One sentence per save for "In short": its own TL;DR if it has one, else its first new claim.
  const short = withNew.slice(0, 3).map((d) => ({ n: latestSaves.indexOf(d) + 1, text: d.tldr?.bullets[0] ?? d.newClaims[0].text }));

  return (
    <Shell
      user={user}
      current="new"
      crumbs={
        <>
          <span>Briefs</span>
          <Icon name="chev" size={12} />
          <span className="here">{latest ? formatDay(latest.day) : 'Today'}</span>
        </>
      }
      actions={
        <Link className="button" href="/paste">
          <Icon name="plus" size={14} />
          Paste a page
        </Link>
      }
    >
      <div className="columns">
        <article className="brief" aria-labelledby="h-brief">
          <header className="brief-head">
            <p className="eyebrow rise">Brief{latest ? ` · ${formatDay(latest.day)}` : ''}</p>
            <h1 id="h-brief" className="headline rise d1">
              {latest ? (
                <>
                  You saved {latest.saves.length}
                  {latest.saves.length === 1 ? ' thing.' : ' things.'}
                  <br />
                  <span className="dim">Here&apos;s what was in {latest.saves.length === 1 ? 'it' : 'them'}.</span>
                </>
              ) : (
                'Nothing checked yet.'
              )}
            </h1>
            {latest && (
              <p className="lede rise d2">
                {plural(latest.newTotal, 'new idea')}, {latest.knownTotal} {latest.knownTotal === 1 ? 'claim' : 'claims'} you already knew.
              </p>
            )}
            {waiting > 0 && <p className="status rise d2">{waiting} more still waiting to be checked.</p>}
          </header>

          {items.length === 0 && (
            <p className="empty">
              Save a page from the extension with Alt+S, or <Link href="/paste">paste one</Link>. Your brief will show here.
            </p>
          )}

          {short.length > 0 && (
            <section aria-labelledby="h-short" className="inshort rise d3">
              <h2 id="h-short">In short</h2>
              <ul className="short">
                {short.map((s) => (
                  <li key={s.n}>
                    <span className="bullet" aria-hidden="true" />
                    <span>
                      {s.text} <a className="cite" href={`#ref-${s.n}`}>{s.n}</a>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {withNew.length > 0 && (
            <div className="sections stagger">
              {withNew.map((d, i) => (
                <BriefSection key={d.id} d={d} n={latestSaves.indexOf(d) + 1} open={i === 0} projects={projectsOfSource(exp, d.id)} />
              ))}
            </div>
          )}

          {leftOut.length > 0 && (
            <section aria-labelledby="h-skip" className="leftout">
              <h2 id="h-skip">Left out of this brief</h2>
              <p>
                {plural(leftOut.length, 'save')} only repeated things you already know, so {leftOut.length === 1 ? 'it' : 'they'} stayed in your library:{' '}
                {leftOut.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <Link href={sourceHref(d.id)}>{d.title}</Link>
                  </span>
                ))}
                .
              </p>
            </section>
          )}

          {latestSaves.length > 0 && (
            <section aria-labelledby="h-refs" className="refs-sec">
              <h2 id="h-refs">References</h2>
              <ul className="refs">
                {latestSaves.map((d, i) => (
                  <li key={d.id}>
                    <Link id={`ref-${i + 1}`} className="ref" href={sourceHref(d.id)}>
                      <span className="n">{i + 1}</span>
                      <span className="t">
                        {d.title}
                        <small>
                          {[hostOf(d.url), `saved ${formatDate(d.savedAt)}`].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                      <span className="k">{d.percentNew}% new</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {days.length > 1 && (
            <section className="earlier" aria-labelledby="h-earlier">
              <h2 id="h-earlier">Earlier briefs</h2>
              {days.slice(1).map((d) => (
                <DayCard key={d.day} d={d} />
              ))}
            </section>
          )}
        </article>

        <aside className="stack" aria-label="Context">
          <section className="stack rise d3" aria-labelledby="h-kb">
            <h2 id="h-kb">Your knowledge base</h2>
            <p className="kb-num">
              {latest && <b>+{latest.newTotal}</b>}
              <span>
                {latest ? `ideas in this brief · ${claimCount} total` : `${plural(claimCount, 'claim')} so far`}
              </span>
            </p>
            <div className="kb-map">
              {preview.nodes.length > 0 && <GraphPreview data={preview} />}
            </div>
            <p className="muted">
              {plural(exp.projects.length, 'project')}, {plural(exp.concepts.length, 'concept')}, {plural(claimCount, 'claim')}.{' '}
              <Link href={dashboardHref('/graph')}>Open full graph</Link>
            </p>
          </section>

          <section className="stack rise d4" aria-labelledby="h-learn">
            <h2 id="h-learn">Worth reading in full</h2>
            {learnNext.length === 0 ? (
              <p className="muted">Nothing queued. Concepts tied to your projects with unread saves appear here.</p>
            ) : (
              <ul className="learn">
                {learnNext.map((item) => (
                  <li key={item.concept}>
                    <p>
                      <strong>{item.concept}</strong> is a gap in <strong>{item.project}</strong>.
                    </p>
                    <ul>
                      {item.unreadSources.map((s) => (
                        <li key={s.id}>
                          <Link href={sourceHref(s.id)}>{s.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="stack rise d4" aria-labelledby="h-proj">
            <h2 id="h-proj">By project</h2>
            {coverage.length === 0 ? (
              <p className="muted">No projects yet.</p>
            ) : (
              <>
                {coverage.map((p, i) => (
                  <div key={p.name}>
                    <div className="cover-row">
                      <span>
                        <span className="proj-dot" style={{ background: projectColor(i) }} aria-hidden="true" />
                        {p.name}
                      </span>
                      <span className="mono-sm">
                        {p.read} of {p.total}
                      </span>
                    </div>
                    <div className="meter" role="img" aria-label={`${p.read} of ${p.total} concepts read`}>
                      <span style={{ width: `${p.total === 0 ? 0 : (p.read / p.total) * 100}%`, background: projectColor(i) }} />
                    </div>
                  </div>
                ))}
                <p className="muted">Share of each project&apos;s concepts you have read about.</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function BriefSection({
  d,
  n,
  open,
  projects,
}: {
  d: SourceDetail & { savedAt: string };
  n: number;
  open: boolean;
  projects: { name: string; color: string }[];
}) {
  const body = d.tldr?.bullets.length ? d.tldr.bullets.join(' ') : d.newClaims.slice(0, 3).map((c) => c.text).join(' ');
  return (
    <section className="brief-sec" aria-label={d.title}>
      <div className="sec-meta">
        {projects.map((p) => (
          <span key={p.name} className="chip">
            <span className="sq" style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
        <span>
          {d.newCount} new · {d.repeatCount} known
        </span>
      </div>
      <h2>
        <Link href={sourceHref(d.id)}>{d.title}</Link>
      </h2>
      <p className="sec-body">
        {body}
        <a className="cite" href={`#ref-${n}`}>
          {n}
        </a>
      </p>
      {d.tldr?.whyItMatters && <p className="lede">{d.tldr.whyItMatters}</p>}
      <details className="deeper" open={open}>
        <summary>
            <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
            <span className="when-closed">Go deeper</span>
            <span className="when-open">Hide new ideas</span>
        </summary>
        <div className="deeper-body">
          <Link className="srccard" href={sourceHref(d.id)}>
            <Ledger newPart={d.newCount} repeatPart={d.repeatCount} label={`${d.newCount} new, ${d.repeatCount} already known`} />
            {d.newClaims.map((c) => (
              <p key={c.id}>{c.text}</p>
            ))}
            <span className="cta">
              Open the full save <Icon name="arrow" size={13} />
            </span>
          </Link>
        </div>
      </details>
      {d.repeatCount > 0 && <p className="muted">{plural(d.repeatCount, 'point')} you already knew {d.repeatCount === 1 ? 'was' : 'were'} skipped.</p>}
    </section>
  );
}

function DayCard({ d }: { d: DigestDay }) {
  const more = d.newTotal - d.ideas.length;
  return (
    <article className="day-card" aria-label={formatDay(d.day)}>
      <div className="day-head">
        <h3>{formatDay(d.day)}</h3>
        <span className="mono-sm">
          {d.newTotal} new · {d.knownTotal} known
        </span>
      </div>
      <Ledger newPart={d.newTotal} repeatPart={d.knownTotal} label={`${d.newTotal} new, ${d.knownTotal} already known`} />
      {d.ideas.length > 0 ? (
        <ul className="claims ideas">
          {d.ideas.map((c) => (
            <li key={c.id} className="idea">
              <p>{c.text}</p>
              <Link className="idea-src" href={sourceHref(c.sourceId)}>
                {c.sourceTitle}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing new that day. You knew all of it already.</p>
      )}
      <p className="muted day-foot">
        {more > 0 && <span>+{more} more new {more === 1 ? 'idea' : 'ideas'} in </span>}
        {d.saves.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ' · '}
            <Link href={sourceHref(s.id)}>{s.title}</Link>
          </span>
        ))}
      </p>
    </article>
  );
}
