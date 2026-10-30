import { CORS_HEADERS } from '../../../server/billing/cors';
import { requestUser } from '../../../server/auth/identity';
import { getDeps } from '../../../server/deps';
import type { PipelineDeps } from '../../../server/pipeline/deps';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...CORS_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export interface Ctx {
  request: Request;
  userId: string;
  deps: PipelineDeps;
}

/** Rejects a request with no verified user (see `requestUser`) and turns a thrown error into a JSON 500. */
export function withUser(handler: (ctx: Ctx) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const userId = await requestUser(request);
      if (!userId) return json({ error: 'missing user' }, 401);
      return await handler({ request, userId, deps: await getDeps() });
    } catch (err) {
      console.error(err);
      return json({ error: err instanceof Error ? err.message : 'internal error' }, 500);
    }
  };
}
