import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { dashboardUser, ensureAccount } from '../../../server/auth/identity';
import { getGraph } from '../../../server/deps';
import { AskForm } from '../AskForm';
import { PageLoading, Shell } from '../Parts';

export const metadata: Metadata = { title: 'Ask' };

export default function AskPage(props: PageProps<'/dashboard/ask'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading…" />}>
      <Ask searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Ask({ searchParams }: { searchParams: PageProps<'/dashboard/ask'>['searchParams'] }) {
  await connection();
  const user = await dashboardUser((await searchParams).user);
  await ensureAccount(await getGraph(), user);
  return (
    <Shell user={user} current="ask" narrow crumbs={<span className="here">Ask</span>}>
      <div className="stack ask-page rise">
        <div>
          <p className="eyebrow">Ask</p>
          <h1>Ask your brain</h1>
          <p className="muted">Answers use only claims from your own saves.</p>
        </div>
        <AskForm />
      </div>
    </Shell>
  );
}
