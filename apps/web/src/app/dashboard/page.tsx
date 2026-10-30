import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getDeps } from '../../server/deps';
import { getSourceResponse } from '../../server/pipeline/result';
import { buildForceData, buildWholeGraph, filterForceData } from './graph-model';
import { GraphPreview } from './GraphPreview';
import { Ledger, PageLoading, Shell } from './Parts';
import {
  buildDailyDigest,
  buildSourceDetail,
  dashboardHref,
  formatDay,
  isChecked,
  projectCoverage,
  resolveUser,
  sourceHref,
  mergeLibrary,
  SOURCE_STATUSES,
  type DigestDay,
} from './view-model';

const SHOWN_DAYS = 5;
const MAX_SAVES = 24;

export default function WhatsNewPage(props: PageProps<'/dashboard'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading what is new…" />}>
      <WhatsNew searchParams={props.searchParams} />
    </Suspense>
  );
}

async function WhatsNew({ searchParams }: { searchParams: PageProps<'/dashboard'>['searchParams'] }) {
  await connection();
  const user = resolveUser((await searchParams).user);
  const deps = await getDeps();
  const { graph } = deps;
  await graph.ensureUser(user, `${user}@example.com`);
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
  const loaded = await Promise.all(
    recent.map((i) =>
      getSourceResponse(deps, user, i.id).then(
        (res) => ({ detail: buildSourceDetail(res), savedAt: i.savedAt }),
        () => null,
      ),
    ),
  );
  const days = buildDailyDigest(loaded.filter((x) => x !== null));
  const latest = days[0];

  const coverage = projectCoverage(exp);
  const claimCount = exp.sources.reduce((n, s) => n + s.made.length, 0);
  const preview = filterForceData(buildForceData(buildWholeGraph(exp), ''), new Set(['Claim', 'Source']));

  return (
    <Shell user={user} current="new">
      <div className="columns">
        <section className="stack feed" aria-labelledby="new-title">
          <div>
            <p className="eyebrow">{latest ? formatDay(latest.day) : 'Daily summary'}</p>
            <h1 id="new-title" className="headline">
              {latest
                ? `${latest.newTotal} new ${latest.newTotal === 1 ? 'idea' : 'ideas'} from ${latest.saves.length} ${latest.saves.length === 1 ? 'save' : 'saves'}.`
                : 'Nothing checked yet.'}
            </h1>
            {latest && (
              <p className="lede">
                {latest.knownTotal} other {latest.knownTotal === 1 ? 'claim was' : 'claims were'} things you already knew.
              </p>
            )}
            {waiting > 0 && <p className="status">{waiting} more still waiting to be checked.</p>}
          </div>

          {items.length === 0 && (
            <p className="empty">
              Save a page from the extension with Alt+S, or <Link href="/">paste one</Link>. Your daily summary will show here.
            </p>
          )}

          {days.map((d, i) => (
            <DayCard key={d.day} d={d} user={user} first={i === 0} />
          ))}
        </section>

        <aside className="stack" aria-label="Context">
          <section className="panel" aria-labelledby="graph-title">
            <div className="panel-head">
              <h2 id="graph-title">Your graph</h2>
              <Link href={dashboardHref(user, '/graph')}>Open full graph</Link>
            </div>
            {preview.nodes.length > 0 && <GraphPreview data={preview} />}
            <p className="muted">
              {exp.projects.length} {exp.projects.length === 1 ? 'project' : 'projects'}, {exp.concepts.length}{' '}
              {exp.concepts.length === 1 ? 'concept' : 'concepts'}, {claimCount} {claimCount === 1 ? 'claim' : 'claims'}.
            </p>
          </section>

          <section className="panel" aria-labelledby="learn-title">
            <h2 id="learn-title">Learn next</h2>
            {learnNext.length === 0 ? (
              <p className="muted">Nothing queued. Concepts tied to your projects with unread saves appear here.</p>
            ) : (
              <ul className="learn">
                {learnNext.map((item) => (
                  <li key={item.concept}>
                    <p>
                      <strong>{item.concept}</strong> <span className="muted">is a gap in {item.project}</span>
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
            {coverage.length === 0 ? (
              <p className="muted">No projects yet.</p>
            ) : (
              <>
                <ul className="plain">
                  {coverage.map((p) => (
                    <li key={p.name}>
                      <div className="cover-row">
                        <strong>{p.name}</strong>
                        <span className="mono-sm">
                          {p.read} of {p.total}
                        </span>
                      </div>
                      <div className="meter" role="img" aria-label={`${p.read} of ${p.total} concepts read`}>
                        <span style={{ width: `${p.total === 0 ? 0 : (p.read / p.total) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="muted">Share of each project&apos;s concepts you have read about.</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function DayCard({ d, user, first }: { d: DigestDay; user: string; first: boolean }) {
  const more = d.newTotal - d.ideas.length;
  return (
    <article className="day-card" aria-label={formatDay(d.day)}>
      <div className="day-head">
        <h2>{first ? 'Top new ideas' : formatDay(d.day)}</h2>
        <span className="mono-sm">
          {d.newTotal} new · {d.knownTotal} known
        </span>
      </div>
      <Ledger newPart={d.newTotal} repeatPart={d.knownTotal} label={`${d.newTotal} new, ${d.knownTotal} already known`} />
      {d.ideas.length > 0 ? (
        <ul className="claims">
          {d.ideas.map((c) => (
            <li key={c.id} className="idea">
              <p>{c.text}</p>
              <Link className="idea-src" href={sourceHref(user, c.sourceId)}>
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
            <Link href={sourceHref(user, s.id)}>{s.title}</Link>
          </span>
        ))}
      </p>
    </article>
  );
}
