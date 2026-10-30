'use client';

import { useEffect, useState } from 'react';
import { APP_NAME } from '../../brand';

const STEPS = [
  { title: 'Save while you scroll', body: `Press ⌥S, click save, or just bookmark on X. ${APP_NAME} queues it.` },
  { title: 'Read for you', body: 'Each post, thread or article is broken into short, standalone points.' },
  { title: 'Skip what you know', body: 'Points are matched by meaning against your knowledge base. Repeats drop out.' },
  { title: 'Get your brief', body: 'New ideas become a short newsletter with references, and join your knowledge base.' },
];

function Score({ pct, v, children }: { pct: number; v: string; children: React.ReactNode }) {
  return (
    <span className="sc">
      <span><i className="bar" style={{ width: `${pct}%` }} /></span>
      <span className="mono">{v}</span>
      {children}
    </span>
  );
}

export function Steps() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const running = auto && !reduced;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 5000);
    return () => clearTimeout(t);
  }, [running, step]);

  return (
    <div className="steps">
      <div role="tablist" aria-label="Steps" className="tabs">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            role="tab"
            id={`step-tab-${i}`}
            aria-selected={i === step}
            aria-controls="step-panel"
            tabIndex={i === step ? 0 : -1}
            className="tab"
            onClick={() => {
              setStep(i);
              setAuto(false);
            }}
          >
            <span className="row">
              <span className="num">0{i + 1}</span>
              <span className="tt">{s.title}</span>
            </span>
            <span className="bd">{s.body}</span>
            {i === step && running && (
              <span aria-hidden="true" className="track"><i key={step} className="progress" /></span>
            )}
          </button>
        ))}
      </div>

      <div className="stage" role="tabpanel" id="step-panel" aria-labelledby={`step-tab-${step}`} aria-live={running ? 'off' : 'polite'}>
        {step === 0 && (
          <div key={0} className="scene mid stagger">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <kbd className="press">⌥</kbd>
              <span style={{ fontSize: 20, color: 'var(--faint)' }}>+</span>
              <kbd className="press">S</kbd>
            </div>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>or</span>
            <span style={{ height: 44, padding: '0 18px', borderRadius: 11, border: '1px solid #22201D', background: '#171614', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
              Save this page
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center' }}>X bookmarks sync on their own. Highlights and notes ride along.</span>
          </div>
        )}
        {step === 1 && (
          <div key={1} className="scene" style={{ gap: 16 }}>
            <p className="fade" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--faint)' }}>
              …an autonomous program can buy access to a resource without signup. Payments now settle on Solana as well as EVM chains, and the reference implementation is open source under Apache 2.0…
            </p>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="chip-card">Agents can buy access without signup or keys.</span>
              <span className="chip-card">Payments settle on Solana as well as EVM chains.</span>
              <span className="chip-card">The reference implementation is Apache 2.0.</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--dim)', paddingLeft: 2 }}>12 claims extracted · 1.1s</span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div key={2} className="scene stagger">
            <div className="claim known fold">
              <span>Agents can buy access without signup or keys.</span>
              <Score pct={94} v="0.94">Known · you read it Oct 12</Score>
            </div>
            <div className="claim">
              <span>Payments settle on Solana as well as EVM chains.</span>
              <Score pct={31} v="0.31"><span className="newtag">New</span></Score>
            </div>
            <div className="claim">
              <span>The reference implementation is Apache 2.0.</span>
              <Score pct={22} v="0.22"><span className="newtag">New</span></Score>
            </div>
          </div>
        )}
        {step === 3 && (
          <div key={3} className="scene mini stagger">
            <p className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>YOUR BRIEF · FRIDAY 8:00 AM · 4 MIN</p>
            <p style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.025em' }}>Agents can now pay on Solana</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)' }}>
              Payments settle on Solana as well as EVM chains, and the reference code is now Apache 2.0. <span className="cite on">1</span> <span className="cite">2</span>
            </p>
            <div style={{ padding: '10px 14px', borderLeft: '1px solid #2F2C28', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>[1] 𝕏 @agentpay_dev · bookmarked Mon</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-3)' }}>&ldquo;Payments now settle on Solana, not just EVM.&rdquo;</span>
            </div>
            <span className="status"><span className="dot" />2 new ideas added to your knowledge base under Orbit</span>
          </div>
        )}
      </div>
    </div>
  );
}
