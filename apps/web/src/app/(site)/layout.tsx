import type { Metadata } from 'next';
import { geist, geistMono } from '../dashboard/fonts';
import { APP_NAME } from '../brand';
import './marketing.css';

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · Read it at last`, template: `%s · ${APP_NAME}` },
  description: 'Save posts, threads and articles while you scroll. Get a short daily brief with references, and skip what you already know.',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`mk ${geist.variable} ${geistMono.variable}`}>{children}</div>;
}
