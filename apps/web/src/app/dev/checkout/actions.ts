'use server';

import { redirect } from 'next/navigation';
import { sendDevPayment } from '../../../server/billing/dev-event';
import { isProduct } from '../../../server/billing/products';
import { getGraph } from '../../../server/deps';

export async function payTest(formData: FormData): Promise<void> {
  const product = formData.get('product');
  const user = formData.get('user');
  if (!isProduct(product) || typeof user !== 'string' || !user) throw new Error('bad checkout request');
  const status = await sendDevPayment(await getGraph(), user, product);
  const query = new URLSearchParams({ product, user, webhook: String(status) });
  redirect(`/dev/checkout?${query}`);
}
