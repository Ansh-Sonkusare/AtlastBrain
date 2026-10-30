import type { Metadata } from 'next';
import '../dashboard/dashboard.css';
import { geist, geistMono } from '../dashboard/fonts';
import { PasteForm } from './PasteForm';

export const metadata: Metadata = { title: 'Paste a page' };

export default function Paste() {
  return (
    <div className={`dash ${geist.variable} ${geistMono.variable}`}>
      <PasteForm />
    </div>
  );
}
