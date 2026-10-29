import { Readability } from '@mozilla/readability';
import type { PagePayload } from '@/lib/extract';

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr, br, div, section, article';

/** Readability's textContent glues paragraphs together when the HTML has no whitespace between them. */
function articleText(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll(BLOCKS).forEach((el) => el.after('\n'));
  return (body.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

export default defineUnlistedScript(() => {
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone).parse();
  const result: PagePayload = {
    url: location.href,
    title: article?.title || document.title,
    text: article?.content ? articleText(article.content) : (document.body?.innerText ?? '').trim(),
    selection: window.getSelection()?.toString() || undefined,
  };
  return result;
});
