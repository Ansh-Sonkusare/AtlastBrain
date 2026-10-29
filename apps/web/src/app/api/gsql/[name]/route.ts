import { readGsql } from '../../../../server/brain/gsql';
import { json, OPTIONS, text, withUser } from '../../_lib/http';

export { OPTIONS };

export function GET(request: Request, ctx: RouteContext<'/api/gsql/[name]'>): Promise<Response> {
  return withUser(async () => {
    const { name } = await ctx.params;
    const query = await readGsql(name);
    return query === null ? json({ error: 'unknown query' }, 404) : text(query);
  })(request);
}
