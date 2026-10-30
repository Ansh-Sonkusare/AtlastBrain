import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '../chrome';
import { Pricing } from './Pricing';

export const metadata: Metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <>
      <SiteHeader current="pricing" />
      <Pricing />
      <SiteFooter />
    </>
  );
}
