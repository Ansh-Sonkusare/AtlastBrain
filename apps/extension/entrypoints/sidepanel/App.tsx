import { useEffect, useState } from 'react';
import type { Settings } from '@/lib/api-types';
import { connectUrl, loadSettings } from '@/lib/settings';
import { buildReceipt, dashboardUrl, type Receipt } from '@/lib/view-model';
import { QuickNote } from './QuickNote';
import { useSave } from './useSave';

const RECENT_LIMIT = 5;

function open(url: string) {
  void browser.tabs.create({ url });
}

const RING = 188.5;

function Arrow() {
  return (
    <span className="arrow">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

function Result({ receipt, settings }: { receipt: Receipt; settings: Settings }) {
  const { newCount, repeatCount, percentNew } = receipt;
  return (
    <section aria-labelledby="res" className="result">
      <div className="summary">
        <div className="ringbox">
          <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`${percentNew} percent of this page is new to you`}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="#1C1A17" strokeWidth="6" />
            <circle className="ring" cx="36" cy="36" r="30" fill="none" stroke="#C9974E" strokeWidth="6" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - percentNew / 100)} />
          </svg>
          <span className="pct-label">{percentNew}%</span>
        </div>
        <div>
          <h2 id="res">{newCount} new {newCount === 1 ? 'idea' : 'ideas'}</h2>
          <p>{repeatCount} you already knew</p>
        </div>
      </div>
      {receipt.newClaims.length > 0 && (
        <ul className="claims">
          {receipt.newClaims.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      {receipt.nothingNew && <p className="status">Nothing new here. You already know this.</p>}
      {receipt.partial && <p className="status warn">Only part of this page could be checked.</p>}
      <a className="row open-row" href={dashboardUrl(settings.apiBase, receipt.sourceId)} onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}>
        <span className="dot" />
        <span>See what's new in dashboard</span>
        <Arrow />
      </a>
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

function Connect({ settings }: { settings: Settings }) {
  return (
    <main>
      <div className="body">
        <section className="page" aria-labelledby="connect-title">
          <h1 id="connect-title">Connect your account</h1>
          <p className="muted">Sign in on the web once, and this panel saves pages to your Atlas.</p>
          <a className="save" href={connectUrl(settings.apiBase)} onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}>Connect your account</a>
        </section>
      </div>
    </main>
  );
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const read = () => void loadSettings().then(setSettings);
    read();
    browser.storage.onChanged.addListener(read);
    return () => browser.storage.onChanged.removeListener(read);
  }, []);

  if (!settings) return null;
  return settings.token ? <Panel settings={settings} /> : <Connect settings={settings} />;
}

function Panel({ settings }: { settings: Settings }) {
  const { state, me, savePage, saveNote } = useSave();
  const [recent, setRecent] = useState<Receipt[]>([]);
  const tab = useActiveTab();
  const busy = state.phase === 'checking' || state.phase === 'blocked';

  useEffect(() => {
    if (state.phase !== 'done') return;
    const receipt = buildReceipt(state.result);
    setRecent((list) => [receipt, ...list.filter((r) => r.sourceId !== receipt.sourceId)].slice(0, RECENT_LIMIT));
  }, [state]);

  const done = state.phase === 'done' ? buildReceipt(state.result) : null;
  const earlier = recent.filter((r) => r.sourceId !== done?.sourceId);

  const checking = state.phase === 'checking';
  const stroke = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

  return (
    <main>
      <header>
        <span className="mark" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 14 14">
            <circle cx="4" cy="4.5" r="2" fill="#090807" />
            <circle cx="10.5" cy="4" r="1.5" fill="#090807" />
            <circle cx="7" cy="10" r="2.3" fill="none" stroke="#090807" strokeWidth="1.3" />
          </svg>
        </span>
        <h1>Atlas</h1>
        <a className="icon" aria-label="Open dashboard" href={dashboardUrl(settings.apiBase)} onClick={(e) => { e.preventDefault(); open(e.currentTarget.href); }}>
          <svg {...stroke}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
        </a>
        <button className="icon" aria-label="Settings" onClick={() => void browser.runtime.openOptionsPage()}>
          <svg {...stroke}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>

      <div className="body">
        <section className="page" aria-label="Current page">
          {checking && <span className="sweep-track" aria-hidden="true"><span /></span>}
          <div className="page-row">
            <span className="glyph" aria-hidden="true">{tab ? tab.host[0] : '–'}</span>
            <div className="page-text">
              {tab ? (
                <>
                  <p className="page-title">{tab.title}</p>
                  <p className="muted">{tab.host}</p>
                </>
              ) : (
                <p className="muted">Open a web page to save it.</p>
              )}
            </div>
          </div>
          <button className={`save${state.phase === 'done' ? ' done' : ''}${busy ? ' busy' : ''}`} disabled={busy || !tab} onClick={savePage} aria-keyshortcuts="Alt+S" aria-live="polite">
            {checking || state.phase === 'blocked' ? (
              <>
                <svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>
                <span>{checking ? 'Reading it for you…' : 'Waiting for checkout…'}</span>
              </>
            ) : state.phase === 'done' ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9974E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="check" d="M20 6 9 17l-5-5" /></svg>
                <span>Saved</span>
              </>
            ) : (
              <span>Save this page</span>
            )}
          </button>
          <div aria-live="polite">
            {state.phase === 'blocked' && (
              <p className="status warn">Free limit reached. Finish checkout in the new tab. This page saves on its own when the plan changes.</p>
            )}
            {state.phase === 'error' && <p className="status error">{state.message}</p>}
          </div>
        </section>

        {busy && (
          <div className="skeleton" aria-hidden="true">
            <div className="top"><span className="disc" /><div className="lines"><i /><i /></div></div>
            <i style={{ width: '100%' }} />
            <i style={{ width: '80%' }} />
          </div>
        )}

        {done && <Result receipt={done} settings={settings} />}

        <div className="spacer" />

        <section aria-labelledby="recent-title" className="session">
          <p className="muted" id="recent-title">This session{earlier.length > 0 ? ` · ${earlier.length}` : ''}</p>
          {earlier.length > 0 ? (
            <ul className="recent">
              {earlier.map((r) => (
                <li key={r.sourceId}>
                  <a
                    className="row"
                    href={dashboardUrl(settings.apiBase, r.sourceId)}
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
            <p className="muted">Nothing saved yet. Each save shows how much of it was new to you.</p>
          )}
        </section>
      </div>

      <footer>
        <QuickNote disabled={busy} onSave={saveNote} />
        <div className="foot-meta">
          <span>{me ? `${me.user.plan === 'pro' ? 'Pro' : 'Free'} · ${me.usage.used} of ${me.usage.limit} saves` : ''}</span>
          <span>⌥S to save</span>
        </div>
      </footer>
    </main>
  );
}
