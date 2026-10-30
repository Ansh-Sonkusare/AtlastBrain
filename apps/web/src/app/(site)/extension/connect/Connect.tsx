'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APP_NAME } from '../../../brand';
import { Brand } from '../../chrome';
import { mintExtensionToken } from './actions';
import { connectTarget } from './target';

/** Chrome exposes this to a page only when an installed extension lists the page's origin in `externally_connectable`. */
interface PageRuntime {
  sendMessage(id: string, message: unknown, reply: (response?: { ok?: boolean }) => void): void;
  lastError?: { message?: string };
}
const pageRuntime = () => (window as unknown as { chrome?: { runtime?: PageRuntime } }).chrome?.runtime;

type View = 'loading' | 'not-installed' | 'open-side-panel' | 'ready' | 'sending' | 'connected';

export function Connect() {
  const [view, setView] = useState<View>('loading');
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = connectTarget(
      new URLSearchParams(window.location.search).get('ext'),
      process.env.NEXT_PUBLIC_EXTENSION_ID,
      process.env.NODE_ENV === 'production',
    );
    setTarget(id);
    setView(!pageRuntime()?.sendMessage ? 'not-installed' : id ? 'ready' : 'open-side-panel');
  }, []);

  // A click rather than on load, so a link someone else sent cannot connect an extension without the user asking.
  const connect = async () => {
    const runtime = pageRuntime();
    if (!runtime || !target) return;
    setView('sending');
    setError(null);
    const minted = await mintExtensionToken().catch(() => ({ error: 'Could not reach the server. Try again.' }));
    if ('error' in minted) {
      setError(minted.error);
      setView('ready');
      return;
    }
    runtime.sendMessage(target, { type: 'atlas-connect', token: minted.token }, (response) => {
      if (runtime.lastError || !response?.ok) {
        setError(`The extension did not answer. Reload it, then open this page again from the ${APP_NAME} side panel.`);
        setView('ready');
      } else {
        setView('connected');
      }
    });
  };

  return (
    <div className="ob">
      <header className="ob-hd">
        <Link href="/" className="brand"><Brand /></Link>
      </header>
      <main className="ob-main">
        <div className="ob-step stagger quick">
          <p className="eyebrow">EXTENSION</p>
          {view === 'connected' ? (
            <>
              <h1>Connected. <span className="soft">You can close this tab.</span></h1>
              <p className="d">The side panel now saves to your account. The connection lasts 90 days, then you connect again.</p>
              <div className="row-btns"><Link href="/dashboard" className="cta">Go to dashboard</Link></div>
            </>
          ) : view === 'not-installed' ? (
            <>
              <h1>Install the extension <span className="soft">first.</span></h1>
              <p className="d">{APP_NAME} isn&apos;t in the Chrome Web Store yet. Run <code>pnpm --filter extension build</code>, open chrome://extensions, turn on Developer mode, and load <code>apps/extension/.output/chrome-mv3</code> with Load unpacked. Then click Connect your account in the side panel.</p>
            </>
          ) : view === 'open-side-panel' ? (
            <>
              <h1>Start from the <span className="soft">side panel.</span></h1>
              <p className="d">Open the {APP_NAME} side panel and click Connect your account. It brings you back here, ready to connect.</p>
            </>
          ) : view === 'loading' ? (
            <h1 className="soft">Looking for the extension…</h1>
          ) : (
            <>
              <h1>Connect this browser&apos;s extension <span className="soft">to your account.</span></h1>
              <p className="d">It will be able to save pages and read your usage as you. Only do this for the {APP_NAME} extension you installed yourself.</p>
              <div aria-live="polite">{error && <p className="d" role="alert">{error}</p>}</div>
              <div className="row-btns">
                <button type="button" className="cta" disabled={view === 'sending'} onClick={connect}>{view === 'sending' ? 'Connecting…' : 'Connect extension'}</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
