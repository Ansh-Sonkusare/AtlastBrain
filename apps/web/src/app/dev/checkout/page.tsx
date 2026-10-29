import { notFound } from 'next/navigation';
import { isProduct } from '../../../server/billing/products';
import { payTest } from './actions';

const LABELS = { pro: 'Pro, $5 per month', credits: 'Credit pack, 200 saves for $3' };

export default async function DevCheckout({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.DODO_PAYMENTS_API_KEY) notFound();
  const { product, user, webhook } = await searchParams;
  if (!isProduct(product) || typeof user !== 'string') notFound();
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>{LABELS[product]}</h1>
      <p>
        This page is a local stand-in for Dodo test checkout. No card is charged. The button sends the signed
        webhook that Dodo would send.
      </p>
      {typeof webhook === 'string' ? (
        <p>{webhook === '200' ? 'Paid. You can close this tab.' : `Webhook failed with status ${webhook}.`}</p>
      ) : (
        <form action={payTest}>
          <input type="hidden" name="product" value={product} />
          <input type="hidden" name="user" value={user} />
          <button type="submit">Pay (test)</button>
        </form>
      )}
    </main>
  );
}
