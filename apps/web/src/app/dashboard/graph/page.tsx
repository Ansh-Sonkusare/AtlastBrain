import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { dashboardUser, ensureAccount } from '../../../server/auth/identity';
import { getDeps } from '../../../server/deps';
import { GraphExplorer } from '../GraphExplorer';
import { buildForceData, buildWholeGraph } from '../graph-model';
import { PageLoading, Shell } from '../Parts';

export const metadata: Metadata = { title: 'Graph' };

export default function GraphPage(props: PageProps<'/dashboard/graph'>) {
  return (
    <Suspense fallback={<PageLoading label="Loading your graph…" />}>
      <Graph searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Graph({ searchParams }: { searchParams: PageProps<'/dashboard/graph'>['searchParams'] }) {
  await connection();
  const user = await dashboardUser((await searchParams).user);
  const { graph } = await getDeps();
  await ensureAccount(graph, user);
  const data = buildForceData(buildWholeGraph(await graph.exportGraph(user)), '');
  for (const n of data.nodes) n.alwaysLabel = n.type === 'Project' || n.type === 'Concept';
  return (
    <Shell user={user} current="graph" full>
      <GraphExplorer data={data} />
    </Shell>
  );
}
