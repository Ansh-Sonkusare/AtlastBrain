export type Product = 'pro' | 'credits';

export const CREDITS_PER_PACK = 200;

/** Without a Dodo account the dev checkout uses these ids. */
export function productIds(env: Env = process.env): Record<Product, string> {
  return {
    pro: env.DODO_PRO_PRODUCT_ID || 'dev_pro',
    credits: env.DODO_CREDITS_PRODUCT_ID || 'dev_credits',
  };
}

export function appUrl(env: Env = process.env): string {
  return (env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function isProduct(value: unknown): value is Product {
  return value === 'pro' || value === 'credits';
}

export type Env = Record<string, string | undefined>;
