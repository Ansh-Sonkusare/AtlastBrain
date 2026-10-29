import { useState } from 'react';
import { createApi } from '@/lib/api';
import type { BrainAnswer } from '@/lib/api-types';
import { loadSettings } from '@/lib/settings';
import { buildAnswerView } from '@/lib/view-model';

export function Ask() {
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
      setRes(await createApi(await loadSettings()).ask(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const view = res ? buildAnswerView(res) : null;
  return (
    <section>
      <textarea
        aria-label="Question"
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask your brain"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button className="primary" disabled={busy || !question.trim()} onClick={submit}>
        Ask
      </button>
      {busy && <p className="status">searching your brain…</p>}
      {error && <p className="status error">{error}</p>}
      {view && (
        <div className="answer">
          <p>{view.answer}</p>
          {view.citations.length > 0 && (
            <ul className="claims">
              {view.citations.map((c) => (
                <li key={c.claimId} className="claim repeat">
                  {c.text}{' '}
                  <span className="source">
                    from{' '}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      {c.sourceTitle}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
