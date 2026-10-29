import { useEffect, useState } from 'react';
import { createApi } from '@/lib/api';
import type { LearnNextItem } from '@/lib/api-types';
import { loadSettings } from '@/lib/settings';

export function LearnNext({ refreshKey }: { refreshKey: string }) {
  const [items, setItems] = useState<LearnNextItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    loadSettings()
      .then((s) => createApi(s).learnNext())
      .then((r) => live && setItems(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [refreshKey]);

  if (error) return <p className="status error">{error}</p>;
  if (!items) return <p className="status">loading…</p>;
  if (items.length === 0) return <p className="muted">Nothing to learn next yet.</p>;
  return (
    <section>
      <ol className="learn">
        {items.slice(0, 3).map((item) => (
          <li key={item.concept}>
            <strong>{item.concept}</strong> <span className="muted">for {item.project}</span>
            <ul>
              {item.unreadSources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
