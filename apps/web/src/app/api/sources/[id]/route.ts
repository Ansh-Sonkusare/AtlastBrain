import { getSourceResponse } from '../../../../server/pipeline/result';
import { json, OPTIONS, withUser } from '../../_lib/http';

export { OPTIONS };

export function GET(request: Request, ctx: RouteContext<'/api/sources/[id]'>): Promise<Response> {
  return withUser(async ({ userId, deps }) => {
    const { id } = await ctx.params;
    if (!(await deps.graph.getSource(userId, id))) return json({ error: 'unknown source' }, 404);
    return json(await getSourceResponse(deps, userId, id));
  })(request);
}
