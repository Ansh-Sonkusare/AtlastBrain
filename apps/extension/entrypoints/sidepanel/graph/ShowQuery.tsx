import { useState } from 'react';
import { createApi } from '@/lib/api';
import { loadSettings } from '@/lib/settings';

/** The GSQL behind the novelty check, shown on demand. */
export function ShowQuery() {
  const [open, setOpen] = useState(false);
  const [gsql, setGsql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || gsql !== null) return;
    setError(null);
    try {
      setGsql(await createApi(await loadSettings()).gsql('known_claims'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <button aria-pressed={open} onClick={toggle}>
        {open ? 'Hide the query' : 'Show the query'}
      </button>
      {open && error && <p className="status error">{error}</p>}
      {open && gsql === null && !error && <p className="status">loading…</p>}
      {open && gsql !== null && <pre className="gsql">{gsql}</pre>}
    </div>
  );
}
