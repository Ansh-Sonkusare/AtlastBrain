import { useEffect, useState } from 'react';
import type { Settings } from '@/lib/api-types';
import { loadSettings } from '@/lib/settings';
import { buildReceipt, dashboardUrl, type Receipt } from '@/lib/view-model';
import { QuickNote } from './QuickNote';
import { useSave } from './useSave';

const RECENT_LIMIT = 5;

function open(url: string) {
  void browser.tabs.create({ url });
}

function Ledger({ receipt }: { receipt: Receipt }) {
  const total = receipt.newCount + receipt.repeatCount;
  return (
    <div
      className="ledger"
      role="img"
      aria-label={`${receipt.newCount} new claims, ${receipt.repeatCount} repeated`}
    >
      {total === 0 ? (
        <span className="seg empty" style={{ flexGrow: 1 }} />
      ) : (
        <>
          <span className="seg new" style={{ flexGrow: receipt.newCount }} />
          <span className="seg repeat" style={{ flexGrow: receipt.repeatCount }} />
        </>
      )}
    </div>
  );
}

function ReceiptCard({ receipt, settings }: { receipt: Receipt; settings: Settings }) {
  return (
    <section className="receipt" aria-labelledby="receipt-title">
      <h2 id="receipt-title">{receipt.title}</h2>
      <Ledger receipt={receipt} />
      <dl className="tally">
        <div className="new">
          <dd>{receipt.newCount}</dd>
          <dt>new</dt>
        </div>
        <div className="repeat">
          <dd>{receipt.repeatCount}</dd>
          <dt>repeated</dt>
        </div>
        <div>
          <dd>{receipt.percentNew}%</dd>
          <dt>new ratio</dt>
        </div>
      </dl>
      {receipt.nothingNew && <p className="muted">Nothing new here. You already know this.</p>}
      {receipt.partial && <p className="status warn">Only part of this page could be checked.</p>}
      <button className="primary wide" onClick={() => open(dashboardUrl(settings.apiBase, settings.userId, receipt.sourceId))}>
        Open in dashboard
      </button>
    </section>
  );
}

export function App() {
  const { state, me, savePage, saveNote } = useSave();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const busy = state.phase === 'checking' || state.phase === 'blocked';

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (state.phase !== 'done') return;
    const receipt = buildReceipt(state.result);
    setRecent((list) => [receipt, ...list.filter((r) => r.sourceId !== receipt.sourceId)].slice(0, RECENT_LIMIT));
  }, [state]);

  const done = state.phase === 'done' ? buildReceipt(state.result) : null;
  const earlier = recent.filter((r) => r.sourceId !== done?.sourceId);

  return (
    <main>
      <header>
        <h1>Second Brain</h1>
        {me?.user.plan === 'pro' && <span className="badge">Pro</span>}
        {settings && (
          <a href={dashboardUrl(settings.apiBase, settings.userId)} onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}>
            Open dashboard
          </a>
        )}
      </header>

      <button className="primary wide" disabled={busy} onClick={savePage}>
        Save this page
      </button>
      <p className="muted">Alt+S saves the current tab.</p>

      <div aria-live="polite">
        {state.phase === 'checking' && <p className="status">Checking against your brain…</p>}
        {state.phase === 'blocked' && (
          <p className="status warn">
            Free limit reached. Finish checkout in the new tab. This page saves on its own when the plan changes.
          </p>
        )}
        {state.phase === 'error' && <p className="status error">{state.message}</p>}
      </div>
      {done && settings && <ReceiptCard receipt={done} settings={settings} />}

      {earlier.length > 0 && settings && (
        <section aria-labelledby="recent-title">
          <h3 id="recent-title">Saved this session</h3>
          <ul className="recent">
            {earlier.map((r) => (
              <li key={r.sourceId}>
                <a
                  href={dashboardUrl(settings.apiBase, settings.userId, r.sourceId)}
                  onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}
                >
                  {r.title}
                </a>
                <span className="muted">
                  {r.newCount} new, {r.repeatCount} repeated
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickNote disabled={busy} onSave={saveNote} />
    </main>
  );
}
