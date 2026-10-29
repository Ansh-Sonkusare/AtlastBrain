'use client';

import { useState } from 'react';

const USER = 'demo';

export default function Paste() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setResult(null);
    const headers = { 'content-type': 'application/json', 'x-user-id': USER };
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: url || undefined, title, text, source: 'web' }),
    });
    const first = (await res.json()) as { sourceId?: string; status?: string; error?: string };
    setResult(first);
    while (first.sourceId && ['pending', 'processing'].includes((first as { status: string }).status)) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await fetch(`/api/sources/${first.sourceId}`, { headers });
      const next = (await poll.json()) as { status: string };
      setResult(next);
      first.status = next.status;
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', display: 'grid', gap: 8, fontFamily: 'system-ui' }}>
      <h1>Second Brain: paste a page</h1>
      <input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="Text" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      <button disabled={busy || !text} onClick={save}>
        {busy ? 'Checking against your brain…' : 'Save'}
      </button>
      {result !== null && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>}
    </main>
  );
}
