'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APP_NAME } from '../../brand';

const PLANS = [
  { name: 'Free', monthly: '$0', yearly: '$0', unit: 'forever', mNote: 'No card needed', yNote: 'No card needed', pitch: 'For trying it on your everyday reading.', cta: 'Get started', hot: false, features: ['50 saves a month', 'Daily or weekly brief, with references', 'Repeats skipped automatically', 'Knowledge base with up to 3 projects', 'Markdown export'] },
  { name: 'Pro', monthly: '$8', yearly: '$6', unit: 'per month', mNote: 'Billed monthly', yNote: '$72 billed yearly', pitch: 'For people who read for a living.', cta: 'Start 14-day trial', hot: true, features: ['Unlimited saves', 'Auto-import X bookmarks', 'Brief by email, and as audio', 'Ask your brain, with sources', 'Unlimited projects', 'Sync to Obsidian and Notion'] },
  { name: 'Team', monthly: '$12', yearly: '$9', unit: 'per user / mo', mNote: 'Billed monthly · 3 seat minimum', yNote: '$108 per user yearly', pitch: 'For research groups and small teams.', cta: 'Talk to us', hot: false, features: ['Everything in Pro', 'Shared team graph', 'See what’s new to the team, not just you', 'Admin and billing controls', 'Priority support'] },
];

const YES = '✓';
const NO = '—';
const ROWS: [string, string, string, string][] = [
  ['Saves per month', '50', 'Unlimited', 'Unlimited'],
  ['Daily or weekly brief', YES, YES, YES],
  ['References on every line', YES, YES, YES],
  ['Repeats skipped', YES, YES, YES],
  ['Auto-import X bookmarks', NO, YES, YES],
  ['Brief by email and audio', NO, YES, YES],
  ['Projects in knowledge base', '3', 'Unlimited', 'Unlimited'],
  ['Ask your brain', NO, YES, YES],
  ['Obsidian and Notion sync', NO, YES, YES],
  ['Markdown export', YES, YES, YES],
  ['Shared team graph', NO, NO, YES],
  ['Admin controls', NO, NO, YES],
];

const FAQS = [
  { q: 'What counts as a save?', a: `One post, thread or article you send to ${APP_NAME}, with the button, ⌥S, or an X bookmark. Notes you type in the side panel are free and unlimited on every plan.` },
  { q: 'What happens when I hit 50 saves on Free?', a: 'Saving pauses until your next month starts. Everything you already saved stays readable, searchable and exportable.' },
  { q: 'Can I cancel anytime?', a: 'Yes. You keep Pro until the end of the period you paid for, then drop to Free with all your data intact.' },
  { q: 'Do you train AI models on my reading?', a: 'No. Your saves are used only to build your own graph and answer your own questions.' },
  { q: 'Is there a student discount?', a: 'Pro is half price for students. Sign up with your university email and the discount applies at checkout.' },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [open, setOpen] = useState(0);

  return (
    <main>
      <section className="wrap price-hero">
        <p className="eyebrow rise">PRICING</p>
        <h1 className="rise d1">Start free. <span className="soft">Pay when it sticks.</span></h1>
        <p className="lede rise d2">Every plan includes the extension, your brief and a knowledge base that grows with you.</p>
        <div className="seg rise d3" role="group" aria-label="Billing period" data-y={yearly}>
          <span className="thumb" aria-hidden="true" />
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
            Yearly <small>−25%</small>
          </button>
        </div>
      </section>

      <section aria-label="Plans" className="wrap plans cards">
        {PLANS.map((p) => (
          <article key={p.name} className={`plan${p.hot ? ' hot' : ''}`}>
            <div className="top">
              <h2>{p.name}</h2>
              {p.hot && <span className="badge">Recommended</span>}
            </div>
            <div className="amt" aria-live="polite">
              <div className="n flip" key={String(yearly)}>
                <b>{yearly ? p.yearly : p.monthly}</b>
                <span>{p.unit}</span>
              </div>
              <span className="fade" key={`n${yearly}`}>{yearly ? p.yNote : p.mNote}</span>
            </div>
            <p className="pitch">{p.pitch}</p>
            <Link href="/signup" className={p.hot ? 'cta' : 'ghost'}>{p.cta}</Link>
            <ul className="feat">
              {p.features.map((f) => (
                <li key={f}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9974E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  {f}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <p className="note">Prices in USD. Student? Pro is half price with a .edu or .ac.in email.</p>

      <section aria-labelledby="h-cmp" className="wrap section" style={{ gap: 32, paddingTop: 'clamp(80px,12vw,140px)' }}>
        <h2 id="h-cmp" className="sec reveal" style={{ fontSize: 'clamp(28px,5vw,36px)' }}>Compare plans</h2>
        <div className="tbl reveal">
          <table>
            <thead>
              <tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th><th scope="col">Team</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([label, ...cells]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {cells.map((c, i) => (
                    <td key={i} className={c === NO ? 'no' : c === YES ? 'yes' : undefined}>
                      {c === NO ? <span aria-label="Not included">{c}</span> : c === YES ? <span aria-label="Included">{c}</span> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h-faq" className="wrap faq" style={{ paddingTop: 'clamp(80px,12vw,140px)' }}>
        <h2 id="h-faq" className="reveal">Questions</h2>
        <div className="faq-list reveal">
          {FAQS.map((f, i) => (
            <div key={f.q}>
              <h3 style={{ font: 'inherit' }}>
                <button type="button" id={`faq-q-${i}`} aria-expanded={open === i} aria-controls={`faq-a-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{f.q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8478" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </h3>
              {open === i && <p className="flip" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="reveal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2>Fifty saves are on us.</h2>
            <p style={{ fontSize: 15 }}>No card needed to start.</p>
          </div>
          <Link href="/signup" className="cta">Get started free</Link>
        </div>
      </section>
    </main>
  );
}
