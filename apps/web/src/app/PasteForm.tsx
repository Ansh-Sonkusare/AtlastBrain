'use client';

import Link from 'next/link';
import { useState } from 'react';

const USER = 'demo';

export function PasteForm() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ sourceId?: string; status?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setResult(null);
    try {
      const headers = { 'content-type': 'application/json', 'x-user-id': USER };
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url || undefined, title, text, source: 'web' }),
      });
      let last = (await res.json()) as { sourceId?: string; status?: string; error?: string };
      setResult(last);
      while (last.sourceId && last.status && ['pending', 'processing'].includes(last.status)) {
        await new Promise((r) => setTimeout(r, 1000));
        const poll = await fetch(`/api/sources/${last.sourceId}`, { headers });
        last = { ...last, ...((await poll.json()) as { status?: string; error?: string }) };
        setResult(last);
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="paste">
      <div>
        <p className="eyebrow">Second Brain</p>
        <h1>Paste a page</h1>
        <p className="muted">See only what is new to you, checked against everything you have read.</p>
      </div>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="paste-url">URL</label>
        <input id="paste-url" type="url" placeholder="https://example.com/article" value={url} onChange={(e) => setUrl(e.target.value)} />
        <label htmlFor="paste-title">Title</label>
        <input id="paste-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="paste-text">Text</label>
        <textarea id="paste-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !text}>
            {busy ? 'Checking against your brain…' : 'Save'}
          </button>
          <Link className="button" href="/dashboard">
            Open the dashboard
          </Link>
        </div>
      </form>
      <div aria-live="polite">
        {result?.error && <p className="status error">{result.error}</p>}
        {result && !result.error && (
          <p className="status">
            {result.status === 'pending' || result.status === 'processing' ? 'Checking…' : `Status: ${result.status}.`}{' '}
            {result.sourceId && <Link href={`/dashboard/source/${encodeURIComponent(result.sourceId)}?user=${USER}`}>Open this save</Link>}
          </p>
        )}
      </div>
    </main>
  );
}
