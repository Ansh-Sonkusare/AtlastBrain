import './dashboard/dashboard.css';
import { geist, geistMono } from './dashboard/fonts';
import { PasteForm } from './PasteForm';

export default function Paste() {
  return (
    <div className={`dash ${geist.variable} ${geistMono.variable}`}>
      <PasteForm />
    </div>
  );
}
