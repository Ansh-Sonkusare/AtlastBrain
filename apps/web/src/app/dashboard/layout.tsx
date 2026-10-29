import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './dashboard.css';

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s | Second Brain' } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="dash">{children}</div>;
}
