'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APP_NAME } from '../../brand';

const PLANS = [
  { name: 'Free', price: '$0', unit: 'forever', note: 'No card needed', pitch: 'For trying it on your everyday reading.', cta: 'Get started', hot: false, features: ['30 saves a month', 'New claims separated from repeats', 'Your knowledge graph', 'Ask your brain, with sources'] },
  { name: 'Pro', price: '$5', unit: 'per month', note: 'Billed monthly', pitch: 'For people who read for a living.', cta: 'Get Pro', hot: true, features: ['500 saves a month', 'Everything in Free', 'Export to Obsidian'] },
  { name: 'Credit pack', price: '$3', unit: 'one time', note: 'Never expires', pitch: 'For a month that runs over.', cta: 'Get started', hot: false, features: ['200 extra saves', 'Used after your monthly allowance', 'Works on any plan'] },
];

const YES = '✓';
const NO = '—';
const ROWS: [string, string, string][] = [
  ['Saves per month', '30', '500'],
  ['Repeats separated from new claims', YES, YES],
  ['Knowledge graph', YES, YES],
  ['Ask your brain', YES, YES],
  ['Export to Obsidian', NO, YES],
];

const FAQS = [
  { q: 'What counts as a save?', a: `One page you send to ${APP_NAME}, from the extension or the paste page.` },
  { q: 'What happens when I hit 30 saves on Free?', a: 'New saves wait until you upgrade, buy a credit pack or the next month starts. Everything you already saved stays readable.' },
  { q: 'Can I cancel anytime?', a: 'Yes. When the subscription ends you drop to Free with all your data intact.' },
  { q: 'Do you train AI models on my reading?', a: 'No. Your saves are used only to build your own graph and answer your own questions.' },
];

export function Pricing() {
  const [open, setOpen] = useState(0);

  return (
    <main>
      <section className="wrap price-hero">
        <p className="eyebrow rise">PRICING</p>
        <h1 className="rise d1">Start free. <span className="soft">Pay when it sticks.</span></h1>
        <p className="lede rise d2">Every plan includes the extension, your brief and a knowledge base that grows with you.</p>
      </section>

      <section aria-label="Plans" className="wrap plans cards">
        {PLANS.map((p) => (
          <article key={p.name} className={`plan${p.hot ? ' hot' : ''}`}>
            <div className="top">
              <h2>{p.name}</h2>
              {p.hot && <span className="badge">Recommended</span>}
            </div>
            <div className="amt">
              <div className="n">
                <b>{p.price}</b>
                <span>{p.unit}</span>
              </div>
              <span>{p.note}</span>
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
      <p className="note">Prices in USD.</p>

      <section aria-labelledby="h-cmp" className="wrap section" style={{ gap: 32, paddingTop: 'clamp(80px,12vw,140px)' }}>
        <h2 id="h-cmp" className="sec reveal" style={{ fontSize: 'clamp(28px,5vw,36px)' }}>Compare plans</h2>
        <div className="tbl reveal">
          <table>
            <thead>
              <tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr>
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
            <h2>Thirty saves a month are on us.</h2>
            <p style={{ fontSize: 15 }}>No card needed to start.</p>
          </div>
          <Link href="/signup" className="cta">Get started free</Link>
        </div>
      </section>
    </main>
  );
}
