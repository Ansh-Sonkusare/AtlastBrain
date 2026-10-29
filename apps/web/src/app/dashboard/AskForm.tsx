'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BrainAnswer } from '../../server/types';
import { ask } from './client-api';
import { buildAnswerView, sourceHref } from './view-model';

export function AskForm({ user }: { user: string }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<BrainAnswer | null>(null);

  const submit = async () => {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await ask(user, q));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const view = res ? buildAnswerView(res) : null;
  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="question">Your question</label>
        <textarea
          id="question"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do I already know about…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div>
          <button className="primary" type="submit" disabled={busy || !question.trim()}>
            {busy ? 'Searching your brain…' : 'Ask'}
          </button>
        </div>
      </form>
      <div aria-live="polite">{error && <p className="status error">{error}</p>}</div>
      {view && (
        <section className="stack" aria-label="Answer">
          <p className="answer">{view.answer}</p>
          {view.citations.length > 0 && (
            <>
              <h3>Built from these claims</h3>
              <ul className="claims">
                {view.citations.map((c) => (
                  <li key={c.claimId} className="claim repeat">
                    <p>{c.text}</p>
                    <p className="claim-meta">
                      From <Link href={sourceHref(user, c.sourceId)}>{c.sourceTitle}</Link>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
