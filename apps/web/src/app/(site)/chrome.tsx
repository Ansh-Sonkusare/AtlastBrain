import Link from 'next/link';
import { APP_NAME } from '../brand';
import { AuthLinks } from './AuthLinks';

export function Logo() {
  return (
    <span className="logo">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="4" cy="4.5" r="2" fill="#090807" />
        <circle cx="10.5" cy="4" r="1.5" fill="#090807" />
        <circle cx="7" cy="10" r="2.3" fill="none" stroke="#090807" strokeWidth="1.3" />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <>
      <Logo />
      <span>{APP_NAME}</span>
    </>
  );
}

export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Cite({ n, glow, on }: { n: number; glow?: boolean; on?: boolean }) {
  return <span className={`cite${glow ? ' glow' : ''}${on ? ' on' : ''}`}>{n}</span>;
}

type Page = 'how' | 'pricing';

export function SiteHeader({ current }: { current?: Page }) {
  const cur = (p: Page) => (current === p ? ({ 'aria-current': 'page' } as const) : {});
  return (
    <header className="hd">
      <div className="hd-in">
        <Link href="/" className="brand">
          <Brand />
        </Link>
        <nav aria-label="Main" className="nav">
          <Link href="/how-it-works" {...cur('how')}>How it works</Link>
          <Link href="/pricing" {...cur('pricing')}>Pricing</Link>
        </nav>
        <div className="acts">
          <AuthLinks />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ full }: { full?: boolean }) {
  if (!full) {
    return (
      <footer className="foot">
        <div className="foot-in slim">
          <span>© 2026 {APP_NAME}</span>
          <span className="foot-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </span>
        </div>
      </footer>
    );
  }
  return (
    <footer className="foot">
      <div className="foot-in">
        <div className="foot-col" style={{ flex: '1 1 240px' }}>
          <b style={{ fontSize: 15, fontWeight: 600 }}>{APP_NAME}</b>
          <span>© 2026 {APP_NAME}</span>
        </div>
        <div className="foot-cols">
          <div className="foot-col">
            <span>Product</span>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div className="foot-col">
            <span>Company</span>
            <a href="#">Contact</a>
          </div>
          <div className="foot-col">
            <span>Legal</span>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
