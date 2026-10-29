import { useState } from 'react';
import { NewToMe } from './NewToMe';
import { LearnNext } from './LearnNext';
import { QuickNote } from './QuickNote';
import { GraphView } from './graph/GraphView';
import { useSave } from './useSave';

type Tab = 'new' | 'learn' | 'graph';

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: "What's new to me" },
  { id: 'learn', label: 'Learn next' },
  { id: 'graph', label: 'Graph' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('new');
  const { state, me, savePage, saveNote } = useSave();
  const busy = state.phase === 'checking' || state.phase === 'blocked';

  return (
    <main>
      <header>
        <h1>Second Brain</h1>
        {me?.user.plan === 'pro' && <span className="badge">Pro</span>}
        <button className="primary" disabled={busy} onClick={savePage}>
          Save this page
        </button>
      </header>
      <p className="hint">Alt+S saves the current tab.</p>

      <nav role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'new' && (
        <section>
          {state.phase === 'idle' && <p className="muted">Save a page to see what is new to you.</p>}
          {state.phase === 'checking' && <p className="status">checking against your brain…</p>}
          {state.phase === 'blocked' && (
            <p className="status warn">
              Free limit reached. Finish checkout in the new tab. This page saves on its own when the plan changes.
            </p>
          )}
          {state.phase === 'error' && <p className="status error">{state.message}</p>}
          {state.phase === 'done' && <NewToMe result={state.result} />}
        </section>
      )}
      {tab === 'learn' && <LearnNext refreshKey={state.phase === 'done' ? state.result.sourceId : ''} />}
      {tab === 'graph' && <GraphView sourceId={state.phase === 'done' ? state.result.sourceId : ''} />}

      <QuickNote disabled={busy} onSave={(text) => { setTab('new'); return saveNote(text); }} />
    </main>
  );
}
