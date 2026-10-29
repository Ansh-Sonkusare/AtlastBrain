import { CORS_HEADERS } from '../../../server/billing/cors';
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

/** Rejects a request without `x-user-id` and turns a thrown error into a JSON 500. */
export function withUser(handler: (ctx: Ctx) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) return json({ error: 'missing user' }, 401);
    try {
      return await handler({ request, userId, deps: await getDeps() });
    } catch (err) {
      console.error(err);
      return json({ error: err instanceof Error ? err.message : 'internal error' }, 500);
    }
  };
}

export function placeholderEmail(userId: string): string {
  return `${userId}@example.com`;
}
