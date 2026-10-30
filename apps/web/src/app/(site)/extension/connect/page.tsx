import type { Metadata } from 'next';
import { Connect } from './Connect';

export const metadata: Metadata = { title: 'Connect the extension' };

export default function ConnectPage() {
  return <Connect />;
}
