import { useState } from 'react';
import { createApi } from '@/lib/api';
import { loadSettings } from '@/lib/settings';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Account() {
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (job: () => Promise<void>) => {
    setError(null);
    setMessage(null);
    setCheckoutUrl(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportVault = () =>
    run(async () => {
      const out = await createApi(await loadSettings()).exportVault();
      if (out.kind === 'upgrade') {
        setCheckoutUrl(out.checkoutUrl);
        setMessage('Export to Obsidian is a Pro feature.');
        return;
      }
      download(out.blob, 'second-brain.zip');
      setMessage('Downloaded second-brain.zip. Open it as an Obsidian vault.');
    });

  const deleteAll = () =>
    run(async () => {
      if (!confirm('Delete all your saved pages, claims, concepts and projects? This cannot be undone.')) return;
      await createApi(await loadSettings()).deleteMe();
      setMessage('Your data is deleted.');
      setTimeout(() => location.reload(), 1200);
    });

  return (
    <details>
      <summary>Your data</summary>
      <div className="account">
        <button onClick={exportVault}>Export to Obsidian</button>
        <button className="danger" onClick={deleteAll}>
          Delete my data
        </button>
      </div>
      {message && <p className="status">{message}</p>}
      {checkoutUrl && (
        <p>
          <a href={checkoutUrl} target="_blank" rel="noreferrer">
            Upgrade to Pro
          </a>
        </p>
      )}
      {error && <p className="status error">{error}</p>}
    </details>
  );
}
