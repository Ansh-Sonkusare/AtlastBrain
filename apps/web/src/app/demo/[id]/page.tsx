import { APP_NAME } from '../../brand';
import { notFound } from 'next/navigation';
import demo from '../../../../../../fixtures/seed/demo.json';
import styles from './article.module.css';

type Article = { title: string; body: string };
const articles = demo as unknown as Record<string, Article>;

export function generateStaticParams() {
  return Object.keys(articles).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: articles[id]?.title ?? 'Not found' };
}

function paragraphs(body: string, perParagraph = 3): string[] {
  if (body.includes('\n\n')) return body.split('\n\n');
  const sentences = body.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) out.push(sentences.slice(i, i + perParagraph).join(' '));
  return out;
}

/**
 * Serves the stage articles as real pages, so the demo can save them with Alt+S.
 * Only the <article> holds fixture text; the masthead and footer sit outside it so extraction sees the same claims.
 */
export default async function DemoArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = articles[id];
  if (!article) notFound();
  const minutes = Math.max(1, Math.round(article.body.split(/\s+/).length / 200));
  return (
    <div className={styles.page}>
      <nav className={styles.masthead}>
        <span className={styles.brand}>Field Notes</span>
        <span className={styles.section}>Engineering</span>
      </nav>
      <article className={styles.article}>
        <h1>{article.title}</h1>
        <p className={styles.byline}>
          By the Field Notes staff · <time dateTime="2026-10-14">October 14, 2026</time> · {minutes} min read
        </p>
        {paragraphs(article.body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <footer className={styles.footer}>Field Notes is a demo publication for {APP_NAME}.</footer>
    </div>
  );
}
