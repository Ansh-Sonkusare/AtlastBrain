import type { SaveResult } from '@/lib/api-types';
import { buildNewToMeView, type RepeatClaim } from '@/lib/view-model';

function Repeat({ claim }: { claim: RepeatClaim }) {
  return (
    <li className="claim repeat">
      {claim.text}{' '}
      <span className="source">
        you read this in{' '}
        <a href={claim.sourceUrl} target="_blank" rel="noreferrer">
          {claim.sourceTitle}
        </a>
      </span>
    </li>
  );
}

export function NewToMe({ result }: { result: SaveResult }) {
  const view = buildNewToMeView(result);
  return (
    <div>
      <h2>{view.title || view.url}</h2>
      {view.highlights.length > 0 && (
        <div className="highlights">
          <h3>Your highlights</h3>
          {view.highlights.map((h) => (
            <blockquote key={h}>{h}</blockquote>
          ))}
        </div>
      )}
      {view.partial && <p className="status warn">Only part of this page could be checked.</p>}

      {view.nothingNew ? (
        <>
          <p className="nothing-new">Nothing new. You already know this.</p>
          {view.readBefore.length > 0 && (
            <ul className="links">
              {view.readBefore.map((l) => (
                <li key={l.url}>
                  you read this in{' '}
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {view.tldr && (
            <div className="tldr">
              <h3>TL;DR</h3>
              <ul>
                {view.tldr.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {view.tldr.whyItMatters && (
                <p>
                  <strong>Why it matters.</strong> {view.tldr.whyItMatters}
                </p>
              )}
            </div>
          )}
          <ul className="claims">
            {view.newClaims.map((c) => (
              <li key={c} className="claim new">
                {c}
              </li>
            ))}
            {view.repeats.map((r) => (
              <Repeat key={r.text} claim={r} />
            ))}
          </ul>
        </>
      )}

      {view.hiddenRepeats.length > 0 && (
        <details>
          <summary>hidden as not new ({view.hiddenRepeats.length})</summary>
          <ul className="claims">
            {view.hiddenRepeats.map((r) => (
              <Repeat key={r.text} claim={r} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
