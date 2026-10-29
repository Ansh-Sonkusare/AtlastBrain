import { json, OPTIONS, withUser } from '../../_lib/http';

export { OPTIONS };

export function GET(request: Request, ctx: RouteContext<'/api/graph/[sourceId]'>): Promise<Response> {
  return withUser(async ({ userId, deps }) => {
    const { sourceId } = await ctx.params;
    if (!(await deps.graph.getSource(userId, sourceId))) return json({ error: 'unknown source' }, 404);
    return json(await deps.graph.neighborhood(userId, sourceId));
  })(request);
}
