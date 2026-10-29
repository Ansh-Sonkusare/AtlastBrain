import { useCallback, useEffect, useRef, useState } from 'react';
import { createApi } from '@/lib/api';
import type { CapturePayload, MeResponse, SaveResult } from '@/lib/api-types';
import { PENDING_CAPTURE_KEY, type ExtractMessage, type ExtractReply } from '@/lib/extract';
import { pollSource } from '@/lib/poll';
import { loadSettings } from '@/lib/settings';

export type SaveState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'blocked' }
  | { phase: 'done'; result: SaveResult }
  | { phase: 'error'; message: string };

export function useSave() {
  const [state, setState] = useState<SaveState>({ phase: 'idle' });
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const run = useRef<AbortController | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await createApi(await loadSettings()).me());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const submit = useCallback(
    async (payload: CapturePayload) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      setState({ phase: 'checking' });
      try {
        const api = createApi(await loadSettings());
        const captured = await api.capture(payload);
        setSourceId(captured.sourceId);
        if (captured.status === 'blocked' && captured.checkoutUrl) {
          await browser.tabs.create({ url: captured.checkoutUrl });
          setState({ phase: 'blocked' });
        }
        let opened = captured.status === 'blocked';
        const result = await pollSource(api, captured.sourceId, {
          signal: controller.signal,
          onUpdate: (r) => {
            if (r.status === 'blocked') {
              setState({ phase: 'blocked' });
              void refreshMe();
              if (!opened && captured.checkoutUrl) void browser.tabs.create({ url: captured.checkoutUrl });
              opened = true;
            } else {
              setState({ phase: 'checking' });
            }
          },
        });
        if (result) {
          setState({ phase: 'done', result });
          void refreshMe();
        }
      } catch (e) {
        if (!controller.signal.aborted) setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    },
    [refreshMe],
  );

  const savePage = useCallback(
    async (reply?: ExtractReply) => {
      setState({ phase: 'checking' });
      const extracted: ExtractReply =
        reply ?? (await browser.runtime.sendMessage({ type: 'extract-active-tab' } satisfies ExtractMessage));
      if (!extracted.ok) {
        setState({ phase: 'error', message: extracted.error });
        return;
      }
      const { url, title, text, selection } = extracted.page;
      await submit({ url, title, text, selection, source: 'extension', capturedAt: new Date().toISOString() });
    },
    [submit],
  );

  const saveNote = useCallback(
    (text: string) =>
      submit({
        url: `voice://${Date.now()}`,
        title: 'Voice note',
        text,
        source: 'voice',
        capturedAt: new Date().toISOString(),
      }),
    [submit],
  );

  useEffect(() => {
    const consume = (value: unknown) => {
      const pending = value as (ExtractReply & { at: number }) | undefined;
      if (!pending || Date.now() - pending.at > 15000) return;
      void browser.storage.session.remove(PENDING_CAPTURE_KEY);
      void savePage(pending);
    };
    browser.storage.session.get(PENDING_CAPTURE_KEY).then((r) => consume(r[PENDING_CAPTURE_KEY]));
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'session' && changes[PENDING_CAPTURE_KEY]) consume(changes[PENDING_CAPTURE_KEY].newValue);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, [savePage]);

  useEffect(() => () => run.current?.abort(), []);

  return { state, me, sourceId, savePage: () => savePage(), saveNote };
}
