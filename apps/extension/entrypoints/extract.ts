import { Readability } from '@mozilla/readability';
import type { PagePayload } from '@/lib/extract';

export default defineUnlistedScript(() => {
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone).parse();
  const result: PagePayload = {
    url: location.href,
    title: article?.title || document.title,
    text: (article?.textContent ?? document.body?.innerText ?? '').replace(/\s+\n/g, '\n').trim(),
    selection: window.getSelection()?.toString() || undefined,
  };
  return result;
});
