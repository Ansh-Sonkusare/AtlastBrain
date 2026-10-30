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
    <div className="stack ask">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="question" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="question"
          rows={2}
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
        <div className="composer-bar">
          <span className="muted">Enter to ask · Shift+Enter for a new line</span>
          <button className="primary" type="submit" disabled={busy || !question.trim()}>
            {busy ? 'Searching…' : 'Ask'}
          </button>
        </div>
      </form>
      <div aria-live="polite">{error && <p className="status error">{error}</p>}</div>
      {view && (
        <section className="stack" aria-label="Answer">
          <div className="panel answer-card">
            <p className="eyebrow">Answer</p>
            <p className="answer">{view.answer}</p>
          </div>
          {view.citations.length > 0 && (
            <>
              <p className="eyebrow">Built from {view.citations.length} of your claims</p>
              <ol className="citations">
                {view.citations.map((c) => (
                  <li key={c.claimId}>
                    <p>{c.text}</p>
                    <p className="muted">
                      From <Link href={sourceHref(user, c.sourceId)}>{c.sourceTitle}</Link>
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </div>
  );
}
