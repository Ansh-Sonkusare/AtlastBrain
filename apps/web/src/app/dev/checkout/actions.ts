'use server';

import { redirect } from 'next/navigation';
import { sendDevPayment } from '../../../server/billing/dev-event';
import { devCheckoutEnabled, isProduct } from '../../../server/billing/products';
import { getGraph } from '../../../server/deps';

export async function payTest(formData: FormData): Promise<void> {
  if (!devCheckoutEnabled()) throw new Error('The dev checkout is off in production and when a Dodo API key is set');
  const product = formData.get('product');
  const user = formData.get('user');
  if (!isProduct(product) || typeof user !== 'string' || !user) throw new Error('bad checkout request');
  const status = await sendDevPayment(await getGraph(), user, product);
  const query = new URLSearchParams({ product, user, webhook: String(status) });
  redirect(`/dev/checkout?${query}`);
}
