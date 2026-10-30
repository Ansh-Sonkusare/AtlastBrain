export const INSTALL_URL = process.env.NEXT_PUBLIC_EXTENSION_INSTALL_URL || '/extension/connect';

const EXTENSION_ID = /^[a-p]{32}$/;

/**
 * Which extension may receive the token. A configured id always wins. Otherwise only a development
 * build trusts the `?ext=` the side panel sends, because unpacked ids differ per machine and a crafted link must not choose the receiver in production.
 */
export function connectTarget(param: string | null, configured: string | undefined, production: boolean): string | null {
  if (configured) return configured;
  if (production) return null;
  return param && EXTENSION_ID.test(param) ? param : null;
}
