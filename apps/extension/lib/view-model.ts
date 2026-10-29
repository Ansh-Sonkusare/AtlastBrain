import type { SaveResult } from './api-types';

export const NOTHING_NEW_BELOW = 0.2;

/** What the side panel shows once a save finishes. The full read lives in the dashboard. */
export interface Receipt {
  sourceId: string;
  title: string;
  newCount: number;
  repeatCount: number;
  /** Whole percent of claims that were new to the user. */
  percentNew: number;
  nothingNew: boolean;
  partial: boolean;
}

export function buildReceipt(result: SaveResult): Receipt {
  const newCount = result.verdicts.filter((v) => v.kind === 'new').length;
  return {
    sourceId: result.sourceId,
    title: result.title || result.url,
    newCount,
    repeatCount: result.verdicts.length - newCount,
    percentNew: Math.round(result.newRatio * 100),
    nothingNew: result.newRatio < NOTHING_NEW_BELOW,
    partial: result.status === 'partial',
  };
}

/** Link into the web dashboard: the library, or one save when `sourceId` is given. */
export function dashboardUrl(apiBase: string, userId: string, sourceId?: string): string {
  const base = apiBase.replace(/\/+$/, '');
  const path = sourceId ? `/dashboard/source/${encodeURIComponent(sourceId)}` : '/dashboard';
  return `${base}${path}?user=${encodeURIComponent(userId)}`;
}
