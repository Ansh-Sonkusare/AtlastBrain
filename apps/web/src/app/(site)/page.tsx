import Link from 'next/link';
import { APP_NAME } from '../brand';
import { Arrow, Cite, SiteFooter, SiteHeader } from './chrome';

const NAME = APP_NAME;

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="wrap hero">
          <h1 className="big rise">
            You saved it.
            <br />
            <span className="soft">{NAME} reads it.</span>
          </h1>
          <p className="lede rise d1">
            Bookmark posts, threads and articles while you scroll. Every morning {NAME} turns them into a short brief with references, and keeps everything in a knowledge base that grows with you.
          </p>
          <div className="cta-row rise d2">
            <Link href="/signup" className="cta">Get your first brief free</Link>
            <Link href="/how-it-works" className="ghost">See how it works</Link>
          </div>
          <p className="fine rise d3">Saves from X, any blog or newsletter, and long threads · Chrome extension</p>

          <div className="demo rise d4">
            <div className="pile" aria-label="Your saved pile">
              <p className="pile-cap">SAVED THIS WEEK · 23 · READ · 0</p>
              <div className="save s1 drop p1">
                <span className="who"><span className="av">𝕏</span><b>@agentpay_dev</b><i>· bookmarked</i></span>
                <span className="body">Payments now settle on Solana, not just EVM. Facilitators for both are live today…</span>
              </div>
              <div className="save s2 drop p2">
                <span className="meta">blog.example.com · 6 min read</span>
                <span className="ttl">How Autonomous Agents Pay for APIs</span>
              </div>
              <div className="save s3 drop p3">
                <span className="who"><span className="av">𝕏</span><b>@retrieval_eng</b><i>· thread, 9 posts</i></span>
                <span className="body">Near-duplicate detection is easy for copies and hard for paraphrases…</span>
              </div>
              <div className="save s4 drop p4">
                <span className="meta">Newsletter · 11 min read</span>
                <span className="ttl">Graph Databases Add Vector Search</span>
              </div>
            </div>

            <svg className="arrow" width="64" height="24" viewBox="0 0 64 24" aria-hidden="true">
              <path className="flow" d="M2 12h54" stroke="#C9974E" strokeWidth="1.6" fill="none" />
              <path d="m52 6 8 6-8 6" stroke="#C9974E" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="brief" aria-label="Your morning brief">
              <p className="kicker line l1">YOUR BRIEF · FRIDAY 8:00 AM · 4 MIN</p>
              <p className="head line l1">23 saves, read for you.</p>
              <p className="para line l2">
                Agent payments now settle on Solana as well as EVM chains, and the reference code is open source. <Cite n={1} glow /> <Cite n={2} />
              </p>
              <p className="para line l3">
                Spotting repeated ideas comes down to one threshold, and paraphrases are the hard part. <Cite n={3} />
              </p>
              <div className="quote line l4">
                <span className="src"><span className="mono">[1]</span>𝕏 @agentpay_dev · bookmarked Mon</span>
                <span className="txt">&ldquo;Payments now settle on Solana, not just EVM. Facilitators for both are live today.&rdquo;</span>
              </div>
              <p className="status line l5"><span className="dot" />4 repeats skipped · 16 new ideas added to your knowledge base</p>
            </div>
          </div>
        </section>

        <section className="wrap section" aria-labelledby="h-feat">
          <div className="reveal" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="eyebrow">WHY {NAME.toUpperCase()}</p>
            <h2 id="h-feat" className="sec">Read-later lists never get read. <span className="soft">A brief does.</span></h2>
          </div>
          <div className="tiles">
            <article className="tile reveal">
              <span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></span>
              <div>
                <h3>Save from anywhere</h3>
                <p className="d">One click or ⌥S on a post, thread, article or newsletter. Or just keep bookmarking on X, and {NAME} picks those up too.</p>
              </div>
              <div className="pills"><span>𝕏 Posts</span><span>Threads</span><span>Blogs</span><span>Newsletters</span></div>
            </article>
            <article className="tile w reveal">
              <span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" /><path d="M18 8h2v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h3" /></svg></span>
              <div>
                <h3>A brief with references, not a backlog</h3>
                <p className="d">Daily or weekly, your saves become a few minutes of reading. Every line cites the post or article it came from.</p>
              </div>
              <p className="sample">
                TigerGraph shipped native vector search in 4.2, so &ldquo;find similar, then traverse&rdquo; is one query. <Cite n={5} /> <Cite n={6} />
              </p>
            </article>
            <article className="tile w reveal">
              <span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></svg></span>
              <div>
                <h3>Go deeper on anything</h3>
                <p className="d">Tap a line to open its sources: the original post, the key points of the article, and a link to read it in full.</p>
              </div>
              <div className="drill">
                <span className="a">[2] blog.example.com · 6 min · you never opened it</span>
                <span className="b">Covers the discovery catalog, per-request spending caps, and why a facilitator pays the gas.</span>
                <span className="c">Read the full piece →</span>
              </div>
            </article>
            <article className="tile reveal">
              <span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg></span>
              <div>
                <h3>A knowledge base that grows</h3>
                <p className="d">Every idea is kept and linked. Repeats are skipped, so your brief only shows what&apos;s new to you.</p>
              </div>
              <svg className="float" width="100%" height="120" viewBox="0 0 300 120" aria-hidden="true">
                <g stroke="#2F2C28" strokeWidth="1" fill="none">
                  <line className="edge" x1="150" y1="60" x2="70" y2="28" />
                  <line className="edge" x1="150" y1="60" x2="80" y2="98" />
                  <line className="edge" x1="70" y1="28" x2="25" y2="66" />
                </g>
                <g stroke="#C9974E" strokeWidth="1.4" fill="none">
                  <line className="edge" x1="150" y1="60" x2="235" y2="28" />
                  <line className="edge" x1="150" y1="60" x2="240" y2="94" />
                </g>
                <circle className="ping" cx="150" cy="60" r="9" fill="none" stroke="#C9974E" />
                <circle className="node" cx="150" cy="60" r="9" fill="#C9974E" />
                <circle className="node" cx="235" cy="28" r="5" fill="#C9974E" />
                <circle className="node" cx="240" cy="94" r="5" fill="#C9974E" />
                <circle className="node" cx="70" cy="28" r="4.5" fill="#3F3A34" />
                <circle className="node" cx="80" cy="98" r="4.5" fill="#3F3A34" />
                <circle className="node" cx="25" cy="66" r="3.5" fill="#3F3A34" />
              </svg>
            </article>
          </div>
        </section>

        <section className="wrap section" aria-labelledby="h-steps">
          <div className="reveal spread">
            <h2 id="h-steps" className="sec">Keep scrolling. <span className="soft">We&apos;ll keep up.</span></h2>
            <Link href="/how-it-works" className="more link">How it works in detail <Arrow /></Link>
          </div>
          <ol className="cols">
            <li className="reveal"><span className="n">01</span><h3>Save while you scroll</h3><p>Bookmark like you always do. No tagging, no folders.</p></li>
            <li className="reveal"><span className="n">02</span><h3>Read your brief</h3><p>In the app or your inbox, at the time you pick. Minutes, not hours.</p></li>
            <li className="reveal"><span className="n">03</span><h3>Dig in or move on</h3><p>Open the sources behind any line. Everything else waits in your knowledge base.</p></li>
          </ol>
        </section>

        <section className="band dots">
          <div className="reveal">
            <h2>Your bookmarks, finally read.</h2>
            <p>Free for 50 saves a month. Your first brief arrives tomorrow morning.</p>
            <div className="cta-row">
              <Link href="/signup" className="cta">Get started free</Link>
              <Link href="/pricing" className="ghost">See pricing</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter full />
    </>
  );
}
