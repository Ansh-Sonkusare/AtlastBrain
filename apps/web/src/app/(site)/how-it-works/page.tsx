import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '../chrome';
import { Steps } from './Steps';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorks() {
  return (
    <>
      <SiteHeader current="how" />
      <main>
        <section className="wrap page-hero">
          <p className="eyebrow rise">HOW IT WORKS</p>
          <h1 className="rise d1">From bookmark to brief, <span className="soft">without the reading pile.</span></h1>
          <p className="lede rise d2">What happens between saving a post and finding it, summarised and cited, in tomorrow&apos;s brief.</p>
        </section>

        <section aria-label="The four steps" className="wrap rise d3">
          <Steps />
        </section>

        <section className="wrap split" aria-labelledby="h-new">
          <div className="reveal">
            <p className="eyebrow">WHAT COUNTS AS NEW</p>
            <h2 id="h-new">Same idea, different words? <span className="soft">Still known.</span></h2>
            <p className="d">Claims are compared by meaning, not wording. A paraphrase of something you&apos;ve read folds away. A genuinely new fact stays front and centre.</p>
          </div>
          <div className="reveal" style={{ flexBasis: 420, gap: 10 }}>
            <div className="box">&ldquo;The facilitator pays the gas, so clients need no native token.&rdquo;</div>
            <div className="sim"><i />similarity 0.91 → same idea</div>
            <div className="box" style={{ color: 'var(--mute)' }}>&ldquo;Because the facilitator covers gas fees, a paying client doesn&apos;t have to hold a native token.&rdquo;</div>
          </div>
        </section>

        <section className="wrap section" aria-labelledby="h-priv" style={{ gap: 40 }}>
          <h2 id="h-priv" className="sec reveal" style={{ fontSize: 'clamp(28px,5vw,40px)' }}>Your reading stays yours.</h2>
          <div className="cols">
            <div className="reveal"><h3>Saves only on your click</h3><p>The extension never reads a page you didn&apos;t save. No browsing history is collected.</p></div>
            <div className="reveal"><h3>Export anytime</h3><p>Take your claims, sources and graph out as Markdown, ready for Obsidian or Notion.</p></div>
            <div className="reveal"><h3>Delete means delete</h3><p>Remove a save and its claims leave the graph with it.</p></div>
          </div>
        </section>

        <section className="band">
          <div className="reveal">
            <h2>Try it on the next tab you open.</h2>
            <div className="cta-row">
              <Link href="/signup" className="cta">Get started free</Link>
              <Link href="/pricing" className="ghost">Pricing</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
