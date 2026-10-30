'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APP_NAME } from '../../brand';
import { Arrow, Brand } from '../chrome';
import { INSTALL_URL } from '../extension/connect/target';
import { finishSetup, skipSetup } from './actions';

const STEPS = 4;
const SUGGESTED = ['Thesis', 'Job hunt', 'Side project', 'Course notes', 'Startup research', 'Reading list'];
const WHENS = [
  { id: 'am', label: 'Every morning', note: '8:00 AM, with your coffee' },
  { id: 'pm', label: 'Every evening', note: '7:00 PM, after work' },
  { id: 'wk', label: 'Once a week', note: 'Sunday 9:00 AM, a longer read' },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(SUGGESTED);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [when, setWhen] = useState('am');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const addCustom = () => {
    const n = custom.trim();
    if (!n) return;
    if (!names.includes(n)) setNames([...names, n]);
    if (!picked.includes(n)) setPicked([...picked, n]);
    setCustom('');
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    const failed = await finishSetup(picked, when).catch(() => 'Could not save your setup. Check your connection and try again.');
    setBusy(false);
    if (failed) setError(failed);
    else setStep(3);
  };

  return (
    <div className="ob">
      <header className="ob-hd">
        <span className="brand"><Brand /></span>
        <div className="ob-prog">
          <span className="mono">{step + 1} of {STEPS}</span>
          <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} className="segs">
            {[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : undefined} />)}
          </div>
        </div>
        {step < 3 && (
          <form action={skipSetup}>
            <button type="submit" className="skip" style={{ border: 0, background: 'transparent' }}>Skip setup</button>
          </form>
        )}
      </header>

      <main className="ob-main">
        {step === 0 && (
          <div key={0} className="ob-step stagger quick">
            <p className="eyebrow">STEP 1</p>
            <h1>Pin the extension <span className="soft">so saving is one click.</span></h1>
            <div className="mock" aria-hidden="true">
              <div className="tb">
                <span className="url">any page you&apos;re reading</span>
                <span className="ext">
                  <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="4" cy="4.5" r="2" fill="#090807" /><circle cx="10.5" cy="4" r="1.5" fill="#090807" /><circle cx="7" cy="10" r="2.3" fill="none" stroke="#090807" strokeWidth="1.3" /></svg>
                  <span className="bob"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg></span>
                </span>
                <span className="puz"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19.4 12a2.4 2.4 0 0 0-2.4-2.4V6a2 2 0 0 0-2-2h-3.6a2.4 2.4 0 1 0-4.8 0H4a2 2 0 0 0-2 2v3.6a2.4 2.4 0 1 1 0 4.8V18a2 2 0 0 0 2 2h3.6a2.4 2.4 0 1 1 4.8 0H15a2 2 0 0 0 2-2v-3.6a2.4 2.4 0 0 0 2.4-2.4z" /></svg></span>
              </div>
              <p>Click the puzzle piece in your toolbar, then the pin next to {APP_NAME}.</p>
            </div>
            <div className="row-btns">
              <button type="button" className="cta" onClick={() => setStep(1)}>I&apos;ve pinned it</button>
              <a href={INSTALL_URL} target="_blank" rel="noreferrer" className="ghost q">Install the extension first</a>
            </div>
          </div>
        )}

        {step === 1 && (
          <div key={1} className="ob-step stagger quick">
            <p className="eyebrow">STEP 2</p>
            <h1>What are you working on?</h1>
            <p className="d">Your brief is grouped by these, and your knowledge base files ideas under them. Pick a few, you can change them later.</p>
            <div role="group" aria-label="Projects" className="chips">
              {names.map((n) => {
                const on = picked.includes(n);
                return (
                  <button key={n} type="button" aria-pressed={on} className="chip" onClick={() => toggle(n)}>
                    {on && <svg className="pop" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9974E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                    {n}
                  </button>
                );
              })}
            </div>
            <form className="addp" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
              <label htmlFor="newp" className="sr">Add a project</label>
              <input id="newp" type="text" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own, e.g. Thesis on graph databases" className="field" />
            </form>
            <div className="row-btns">
              <button type="button" className="cta" onClick={() => { addCustom(); setStep(2); }}>{picked.length === 0 && !custom.trim() ? 'Continue without projects' : 'Continue'}</button>
              <button type="button" className="ghost q" onClick={() => setStep(0)}>Back</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div key={2} className="ob-step stagger quick">
            <p className="eyebrow">STEP 3</p>
            <h1>When do you want to read your brief?</h1>
            <p className="d">Your brief is on your dashboard, and it updates as your saves are checked. We&apos;ll keep this time for scheduled delivery, which isn&apos;t built yet, so nothing gets sent for now.</p>
            <div role="radiogroup" aria-label="Brief schedule" className="radios">
              {WHENS.map((w) => (
                <button key={w.id} type="button" role="radio" aria-checked={when === w.id} className="radio" onClick={() => setWhen(w.id)}>
                  <span aria-hidden="true" className="ring">{when === w.id && <i className="pop" />}</span>
                  <span className="t"><b>{w.label}</b><span>{w.note}</span></span>
                </button>
              ))}
            </div>
            <p className="check" style={{ color: 'var(--dim)' }}>Email delivery is coming later.</p>
            <div aria-live="polite">{error && <p className="d" role="alert">{error}</p>}</div>
            <div className="row-btns">
              <button type="button" className="cta" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Continue'}</button>
              <button type="button" className="ghost q" disabled={busy} onClick={() => setStep(1)}>Back</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div key={3} className="ob-step stagger quick">
            <p className="eyebrow">LAST STEP</p>
            <h1>Connect the extension <span className="soft">to save from any page.</span></h1>
            <p className="d">Open the {APP_NAME} side panel and click Connect your account, then approve it on the page that opens. You can also do this later.</p>
            <div className="row-btns">
              <Link href="/dashboard" className="cta">Go to dashboard <Arrow size={15} /></Link>
              <a href="/extension/connect" target="_blank" rel="noreferrer" className="ghost q">Connection help</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
