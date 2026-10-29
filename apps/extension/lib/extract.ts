export interface PagePayload {
  url: string;
  title: string;
  text: string;
  selection?: string;
}

export type ExtractMessage = { type: 'extract-active-tab' };
export type ExtractReply = { ok: true; page: PagePayload } | { ok: false; error: string };

/** Key in storage.session where the Alt+S command leaves its result for the side panel. */
export const PENDING_CAPTURE_KEY = 'pendingCapture';
