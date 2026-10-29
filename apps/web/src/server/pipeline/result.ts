import type { PipelineDeps } from './deps';
import type { ClaimVerdict, SaveResult } from '../types';

export async function getSaveResult(
  deps: Pick<PipelineDeps, 'graph'>,
  userId: string,
  sourceId: string,
): Promise<SaveResult> {
  const source = await deps.graph.getSource(userId, sourceId);
  if (!source) throw new Error(`Unknown source ${sourceId}`);
  const { made, repeated } = await deps.graph.sourceClaims(userId, sourceId);
  const verdicts: ClaimVerdict[] = [
    ...made.map((c): ClaimVerdict => ({ kind: 'new', text: c.text, claimId: c.id })),
    ...repeated.map(({ text, ...match }): ClaimVerdict => ({ kind: 'repeat', text, match })),
  ];
  return {
    sourceId: source.id,
    status: source.status,
    title: source.title,
    url: source.url,
    newRatio: source.newRatio,
    verdicts,
    tldr: source.tldr,
    ...(source.status === 'blocked' ? { blockedReason: 'quota' as const } : {}),
  };
}

export type SourceResponse = SaveResult & { highlights: string[] };

/** What `GET /api/sources/:id` returns: the save result plus the user's highlights on the page. */
export async function getSourceResponse(
  deps: Pick<PipelineDeps, 'graph'>,
  userId: string,
  sourceId: string,
): Promise<SourceResponse> {
  const [result, highlights] = await Promise.all([
    getSaveResult(deps, userId, sourceId),
    deps.graph.listHighlights(userId, sourceId),
  ]);
  return { ...result, highlights: highlights.map((h) => h.text) };
}
