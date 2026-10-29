import { notFound } from 'next/navigation';
import demo from '../../../../../../fixtures/seed/demo.json';

type Article = { title: string; body: string };
const articles = demo as unknown as Record<string, Article>;

export function generateStaticParams() {
  return Object.keys(articles).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: articles[id]?.title ?? 'Not found' };
}

/** Serves the stage articles as real pages, so the demo can save them with Alt+S. */
export default async function DemoArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = articles[id];
  if (!article) notFound();
  return (
    <article style={{ maxWidth: 680, margin: '48px auto', fontFamily: 'Georgia, serif', lineHeight: 1.6, padding: '0 16px' }}>
      <h1>{article.title}</h1>
      {article.body.split(/(?<=[.!?])\s+/).map((sentence, i) => (
        <p key={i}>{sentence}</p>
      ))}
    </article>
  );
}
