import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AskForm } from '../AskForm';
import { PageLoading, Shell } from '../Parts';
import { resolveUser } from '../view-model';

export const metadata: Metadata = { title: 'Ask' };

export default function AskPage(props: PageProps<'/dashboard/ask'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading…" />}>
      <Ask searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Ask({ searchParams }: { searchParams: PageProps<'/dashboard/ask'>['searchParams'] }) {
  const user = resolveUser((await searchParams).user);
  return (
    <Shell user={user} current="ask">
      <div className="stack wide">
        <div>
          <h1>Ask your brain</h1>
          <p className="muted">Answers use only claims from your own saves.</p>
        </div>
        <AskForm user={user} />
      </div>
    </Shell>
  );
}
