'use client';

import { useState } from 'react';
import { APP_NAME } from '../brand';
import { checkout, exportVault } from './client-api';
import type { Usage } from './view-model';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function PlanPanel({ usage }: { usage: Usage }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const buy = (product: 'pro' | 'credits') =>
    run(async () => {
      const { checkoutUrl } = await checkout(product);
      window.open(checkoutUrl, '_blank', 'noopener');
      setMessage('Checkout opened in a new tab. Reload this page when you are done.');
    });

  const exportToObsidian = () =>
    run(async () => {
      const out = await exportVault();
      if (out.kind === 'upgrade') {
        window.open(out.checkoutUrl, '_blank', 'noopener');
        setMessage('Export to Obsidian is a Pro feature. Checkout opened in a new tab.');
        return;
      }
      download(out.blob, `${APP_NAME.toLowerCase()}.zip`);
      setMessage('Downloaded the vault zip. Open it as an Obsidian vault.');
    });

  return (
    <div className="stack">
      <p>
        <strong>{usage.plan === 'pro' ? 'Pro' : 'Free'}</strong> plan
      </p>
      <div>
        <div className="meter" role="img" aria-label={`${usage.used} of ${usage.limit} saves used this month`}>
          <span style={{ width: `${usage.percentUsed}%` }} />
        </div>
        <p className="muted">
          {usage.used} of {usage.limit} saves this month
          {usage.credits > 0 && `, plus ${usage.credits} credits`}
        </p>
      </div>
      <div className="actions">
        {usage.plan === 'free' && (
          <button className="primary" disabled={busy} onClick={() => buy('pro')}>
            Upgrade to Pro
          </button>
        )}
        <button disabled={busy} onClick={() => buy('credits')}>
          Buy a credit pack
        </button>
        <button disabled={busy} onClick={exportToObsidian}>
          Export to Obsidian
        </button>
      </div>
      <div aria-live="polite">
        {message && <p className="status">{message}</p>}
        {error && <p className="status error">{error}</p>}
      </div>
    </div>
  );
}
