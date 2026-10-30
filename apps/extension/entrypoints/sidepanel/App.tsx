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
    <section className="card receipt" aria-labelledby="receipt-title">
      <p className="eyebrow">Saved just now</p>
      <h2 id="receipt-title">{receipt.title}</h2>
      <p className="headline">
        <span className="big">{receipt.newCount}</span>
        <span>
          new {receipt.newCount === 1 ? 'idea' : 'ideas'} · {receipt.repeatCount} you already knew
        </span>
      </p>
      <Ledger receipt={receipt} />
      {receipt.nothingNew && <p className="muted">Nothing new here. You already know this.</p>}
      {receipt.partial && <p className="status warn">Only part of this page could be checked.</p>}
      <button className="primary wide" onClick={() => open(dashboardUrl(settings.apiBase, settings.userId, receipt.sourceId))}>
        See what's new in dashboard
      </button>
    </section>
  );
}

function useActiveTab() {
  const [tab, setTab] = useState<{ title: string; host: string } | null>(null);
  useEffect(() => {
    const read = () =>
      browser.tabs
        .query({ active: true, lastFocusedWindow: true })
        .then(([t]) => {
          const url = t?.url && /^https?:/.test(t.url) ? new URL(t.url) : null;
          setTab(url ? { title: t?.title || url.host, host: url.host.replace(/^www\./, '') } : null);
        })
        .catch(() => setTab(null));
    void read();
    browser.tabs.onActivated?.addListener(read);
    browser.tabs.onUpdated?.addListener(read);
    return () => {
      browser.tabs.onActivated?.removeListener(read);
      browser.tabs.onUpdated?.removeListener(read);
    };
  }, []);
  return tab;
}

export function App() {
  const { state, me, savePage, saveNote } = useSave();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const tab = useActiveTab();
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
        <span className="mark" aria-hidden="true" />
        <h1>Second Brain</h1>
        {me?.user.plan === 'pro' && <span className="badge">Pro</span>}
        {settings && (
          <a
            className="icon-link"
            href={dashboardUrl(settings.apiBase, settings.userId)}
            onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}
          >
            Dashboard
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </a>
        )}
      </header>

      <section className="card save-card" aria-label="Save the current page">
        <div className="page-line">
          {tab ? (
            <>
              <p className="page-title">{tab.title}</p>
              <p className="muted">{tab.host}</p>
            </>
          ) : (
            <p className="muted">Open a web page to save it.</p>
          )}
        </div>
        <button className="save" disabled={busy || !tab} onClick={savePage} aria-keyshortcuts="Alt+S">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
          {busy ? 'Checking…' : 'Save this page'}
          <kbd>Alt S</kbd>
        </button>
        {state.phase === 'checking' && (
          <div className="progress" role="status">
            <span className="bar" aria-hidden="true" />
            <p className="muted">Reading the page and comparing it with everything you have saved…</p>
          </div>
        )}
        <div aria-live="polite">
          {state.phase === 'blocked' && (
            <p className="status warn">
              Free limit reached. Finish checkout in the new tab. This page saves on its own when the plan changes.
            </p>
          )}
          {state.phase === 'error' && <p className="status error">{state.message}</p>}
        </div>
      </section>

      {done && settings && <ReceiptCard receipt={done} settings={settings} />}

      <section aria-labelledby="recent-title" className="session">
        <p className="eyebrow" id="recent-title">This session</p>
        {earlier.length > 0 && settings ? (
          <ul className="recent">
            {earlier.map((r) => (
              <li key={r.sourceId}>
                <a
                  href={dashboardUrl(settings.apiBase, settings.userId, r.sourceId)}
                  onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}
                  aria-label={`${r.title}: ${r.newCount} new, ${r.repeatCount} known`}
                >
                  <span className="recent-title">{r.title}</span>
                  <span className="pct">{r.percentNew}%</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{done ? 'Earlier saves from this session will list here.' : 'Nothing saved yet. Each save shows how much of it was new to you.'}</p>
        )}
      </section>

      <QuickNote disabled={busy} onSave={saveNote} />
      {me && <p className="muted plan">{settings?.userId} · {me.user.plan === 'pro' ? 'Pro' : 'Free'} plan</p>}
    </main>
  );
}
