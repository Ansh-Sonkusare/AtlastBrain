import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './dashboard.css';
import { geist, geistMono } from './fonts';

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s | Second Brain' } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`dash ${geist.variable} ${geistMono.variable}`}>{children}</div>;
}
