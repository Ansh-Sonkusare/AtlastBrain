import { PENDING_CAPTURE_KEY, type ExtractMessage, type ExtractReply, type PagePayload } from '@/lib/extract';

async function extractFromTab(tabId: number | undefined): Promise<ExtractReply> {
  if (tabId === undefined) return { ok: false, error: 'No active tab.' };
  const { url } = await browser.tabs.get(tabId);
  if (!url || !/^https?:/.test(url)) return { ok: false, error: 'Chrome does not let extensions read this page. Open a web page and try again.' };
  try {
    const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/extract.js'] });
    const page = injection?.result as PagePayload | undefined;
    if (!page || !page.text) return { ok: false, error: 'No readable text on this page.' };
    return { ok: true, page };
  } catch {
    return { ok: false, error: 'Cannot read this tab. Reload the page and try again.' };
  }
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'save-page') return;
    const target = tab ?? (await activeTab());
    if (target?.windowId !== undefined) browser.sidePanel.open({ windowId: target.windowId }).catch(() => {});
    const reply = await extractFromTab(target?.id);
    await browser.storage.session.set({ [PENDING_CAPTURE_KEY]: { ...reply, at: Date.now() } });
  });

  browser.runtime.onMessage.addListener((message: ExtractMessage, _sender, sendResponse) => {
    if (message?.type !== 'extract-active-tab') return;
    activeTab().then((tab) => extractFromTab(tab?.id)).then(sendResponse);
    return true;
  });
});
