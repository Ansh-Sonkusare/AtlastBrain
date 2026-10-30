import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '../brand';
import './dashboard.css';
import { geist, geistMono } from './fonts';

export const metadata: Metadata = { title: { default: 'Dashboard', template: `%s | ${APP_NAME}` } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`dash ${geist.variable} ${geistMono.variable}`}>{children}</div>;
}
