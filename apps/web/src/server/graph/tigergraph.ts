import type {
  CaptureSource,
  ClaimMatch,
  GraphLink,
  GraphNode,
  LearnNextItem,
  Neighborhood,
  Plan,
  SourceStatus,
  Tldr,
  User,
} from '../types';
import type { ConceptRecord, GraphPort, ProjectRecord, RepeatedClaim, SourceRecord } from './port';

export interface TigerGraphConfig {
  url: string;
  graph: string;
  user: string;
  password: string;
}

export function tigerGraphConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TigerGraphConfig {
  return {
    url: (env.TG_URL ?? 'http://127.0.0.1:14240').replace(/\/$/, ''),
    graph: env.TG_GRAPH ?? 'SecondBrain',
    user: env.TG_USER ?? 'tigergraph',
    password: env.TG_PASSWORD ?? 'tigergraph',
  };
}

/** Top-k handed to vectorSearch before the distance cut; matches the memory graph. */
const KNOWN_CLAIMS_K = 5;
const QUERY_TIMEOUT_MS = 60_000;
const VECTOR_TYPES = ['Claim', 'Concept', 'Project'] as const;

export class TigerGraphError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'TigerGraphError';
  }
}

type Attrs = Record<string, unknown>;

interface VertexJson<A = Attrs> {
  v_id: string;
  v_type: string;
  attributes: A;
}

interface EdgeJson {
  e_type: string;
  from_id: string;
  to_id: string;
}

interface UpsertResult {
  accepted_vertices: number;
  accepted_edges: number;
}

interface RestppResponse<T> {
  error: boolean;
  message: string;
  code?: string;
  results?: T;
}

interface SourceAttrs {
  id: string;
  user_id: string;
  url: string;
  title: string;
  kind: string;
  status: string;
  saved_at: string;
  read_at: string;
  content_hash: string;
  body: string;
  new_ratio: number;
  tldr: string;
}

interface UserAttrs {
  id: string;
  email: string;
  plan: string;
  credits: number;
  dodo_customer_id: string;
}

interface ClaimAttrs {
  id: string;
  text: string;
  '@distance': number;
  '@source_id': string;
  '@source_title': string;
  '@source_url': string;
  '@concepts': string[];
}

interface RepeatAttrs extends ClaimAttrs {
  '@repeat_text': string;
}

interface LearnNextAttrs {
  name: string;
  '@project': string;
  '@unread': { id: string; title: string; url: string }[];
}

interface NamedAttrs {
  id: string;
  name: string;
  description?: string;
}

/** An edge upsert payload: from type → from id → edge type → to type → to id → attributes. */
type EdgeTree = Record<string, Record<string, Record<string, Record<string, Record<string, Attrs>>>>>;

interface Upsert {
  vertices?: Record<string, Record<string, Attrs>>;
  edges?: EdgeTree;
}

const wrap = (attrs: Record<string, unknown>): Attrs =>
  Object.fromEntries(
    Object.entries(attrs)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, { value: v }]),
  );

function edge(tree: EdgeTree, fromType: string, fromId: string, type: string, toType: string, toId: string, attrs: Attrs = {}) {
  const byId = (tree[fromType] ??= {});
  const byEdge = (byId[fromId] ??= {});
  const byToType = (byEdge[type] ??= {});
  (byToType[toType] ??= {})[toId] = wrap(attrs);
}

function toSource(a: SourceAttrs): SourceRecord {
  return {
    id: a.id,
    userId: a.user_id,
    url: a.url,
    title: a.title,
    kind: a.kind as CaptureSource,
    status: a.status as SourceStatus,
    savedAt: a.saved_at,
    readAt: a.read_at === '' ? null : a.read_at,
    contentHash: a.content_hash,
    body: a.body,
    newRatio: a.new_ratio,
    tldr: a.tldr === '' ? null : (JSON.parse(a.tldr) as Tldr),
  };
}

function toUser(a: UserAttrs): User {
  return {
    id: a.id,
    email: a.email,
    plan: a.plan as Plan,
    credits: a.credits,
    dodoCustomerId: a.dodo_customer_id,
  };
}

function toMatch(a: ClaimAttrs, distance: number): ClaimMatch {
  return {
    claimId: a.id,
    claimText: a.text,
    distance,
    sourceId: a['@source_id'],
    sourceTitle: a['@source_title'],
    sourceUrl: a['@source_url'],
    concepts: [...a['@concepts']].sort(),
  };
}

type VectorVertex = VertexJson<NamedAttrs> & { Embeddings: { embedding: number[] } };

export function createTigerGraph(config: TigerGraphConfig = tigerGraphConfigFromEnv()): GraphPort {
  const restpp = `${config.url}/restpp`;
  const userParam = (id: string) => ({ id, type: 'User' });

  async function call<T>(path: string, init: RequestInit = {}): Promise<RestppResponse<T>> {
    const res = await fetch(`${restpp}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'GSQL-TIMEOUT': String(QUERY_TIMEOUT_MS), ...init.headers },
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as RestppResponse<T>;
    } catch {
      throw new TigerGraphError(`RESTPP ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
  }

  async function upsert(payload: Upsert, params: Record<string, string> = {}): Promise<UpsertResult> {
    const qs = new URLSearchParams({ vertex_must_exist: 'true', ...params });
    const res = await call<UpsertResult[]>(`/graph/${config.graph}?${qs}`, { method: 'POST', body: JSON.stringify(payload) });
    if (res.error || !res.results) throw new TigerGraphError(`upsert: ${res.message}`, res.code);
    return res.results[0];
  }

  async function getVertex<A>(type: string, id: string): Promise<A | null> {
    const res = await call<VertexJson<A>[]>(`/graph/${config.graph}/vertices/${type}/${encodeURIComponent(id)}`);
    if (res.error) {
      if (res.code === '601') return null;
      throw new TigerGraphError(`get ${type} ${id}: ${res.message}`, res.code);
    }
    return res.results?.[0]?.attributes ?? null;
  }

  /** Runs an installed query. Returns null when a VERTEX<User> parameter names no user. */
  async function query<T>(name: string, params: Record<string, unknown>): Promise<T | null> {
    const res = await call<T[]>(`/query/${config.graph}/${name}`, { method: 'POST', body: JSON.stringify(params) });
    if (res.error) {
      if (res.message.includes('Failed to convert user vertex id')) return null;
      throw new TigerGraphError(`query ${name}: ${res.message}`, res.code);
    }
    return Object.assign({}, ...(res.results ?? [])) as T;
  }

  function requireAccepted(what: string, result: UpsertResult, vertices: number, edges: number) {
    if (result.accepted_vertices < vertices || result.accepted_edges < edges) {
      throw new TigerGraphError(
        `${what}: accepted ${result.accepted_vertices}/${vertices} vertices, ${result.accepted_edges}/${edges} edges`,
      );
    }
  }

  async function getUser(userId: string): Promise<User | null> {
    const a = await getVertex<UserAttrs>('User', userId);
    return a ? toUser(a) : null;
  }

  async function getSource(userId: string, sourceId: string): Promise<SourceRecord | null> {
    const a = await getVertex<SourceAttrs>('Source', sourceId);
    return a && a.user_id === userId ? toSource(a) : null;
  }

  /**
   * `PRINT ... WITH VECTOR` returns an empty list for a vector the HNSW index has not taken
   * in yet, so a list read right after an upsert waits for the index and reads again.
   */
  async function withVectors(name: 'list_concepts' | 'list_projects', key: string, userId: string) {
    const read = async () => (await query<Record<string, VectorVertex[]>>(name, { u: userParam(userId) }))?.[key] ?? [];
    const first = await read();
    if (first.every((v) => v.Embeddings.embedding.length > 0)) return first;
    await waitForVectorIndex(30_000, config);
    return read();
  }

  async function sources(name: string, params: Record<string, unknown>): Promise<SourceRecord[]> {
    const r = await query<{ sources: VertexJson<SourceAttrs>[] }>(name, params);
    return (r?.sources ?? []).map((v) => toSource(v.attributes));
  }

  return {
    async ensureUser(userId, email) {
      await upsert(
        { vertices: { User: { [userId]: wrap({ email, plan: 'free', credits: 0, dodo_customer_id: '' }) } } },
        { new_vertex_only: 'true' },
      );
      const user = await getUser(userId);
      if (!user) throw new TigerGraphError(`ensureUser: ${userId} missing after upsert`);
      return user;
    },
    getUser,
    async updateUser(userId, patch) {
      const attrs = { plan: patch.plan, credits: patch.credits, dodo_customer_id: patch.dodoCustomerId };
      const r = await upsert({ vertices: { User: { [userId]: wrap(attrs) } } }, { update_vertex_only: 'true' });
      if (r.accepted_vertices === 0) throw new TigerGraphError(`Unknown user ${userId}`);
      return (await getUser(userId))!;
    },
    async countSavesSince(userId, since) {
      const r = await query<{ n: number }>('count_saves_since', { u: userParam(userId), since });
      return r?.n ?? 0;
    },
    async findUserByDodoCustomer(customerId) {
      const r = await query<{ users: VertexJson<UserAttrs>[] }>('user_by_dodo_customer', { customer_id: customerId });
      const first = r?.users[0];
      return first ? toUser(first.attributes) : null;
    },
    async recordWebhookEvent(eventId, at) {
      const r = await upsert(
        { vertices: { WebhookEvent: { [eventId]: wrap({ received_at: at }) } } },
        { new_vertex_only: 'true' },
      );
      return r.accepted_vertices === 1;
    },

    async findSource(userId, url, contentHash) {
      const found = await sources('find_source', { u: userParam(userId), url, content_hash: contentHash });
      return found.sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0] ?? null;
    },
    async createSource(s) {
      const edges: EdgeTree = {};
      edge(edges, 'User', s.userId, 'OWNS', 'Source', s.id);
      const attrs = {
        user_id: s.userId,
        url: s.url,
        title: s.title,
        kind: s.kind,
        status: s.status,
        saved_at: s.savedAt,
        read_at: s.readAt ?? '',
        content_hash: s.contentHash,
        body: s.body,
        new_ratio: s.newRatio,
        tldr: s.tldr ? JSON.stringify(s.tldr) : '',
      };
      const r = await upsert({ vertices: { Source: { [s.id]: wrap(attrs) } }, edges });
      requireAccepted(`createSource ${s.id} for user ${s.userId}`, r, 1, 1);
    },
    getSource,
    async updateSource(sourceId, patch) {
      const attrs = {
        status: patch.status,
        new_ratio: patch.newRatio,
        tldr: patch.tldr === undefined ? undefined : patch.tldr ? JSON.stringify(patch.tldr) : '',
        read_at: patch.readAt === undefined ? undefined : (patch.readAt ?? ''),
        title: patch.title,
      };
      const r = await upsert({ vertices: { Source: { [sourceId]: wrap(attrs) } } }, { update_vertex_only: 'true' });
      if (r.accepted_vertices === 0) throw new TigerGraphError(`Unknown source ${sourceId}`);
    },
    async listPendingSources(limit) {
      const found = await sources('pending_sources', { lim: limit });
      return found.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    },
    async listSourcesByStatus(userId, status) {
      return sources('sources_by_status', { u: userParam(userId), status });
    },
    async markRead(userId, sourceId, at) {
      if (!(await getSource(userId, sourceId))) throw new TigerGraphError(`Unknown source ${sourceId}`);
      const edges: EdgeTree = {};
      edge(edges, 'User', userId, 'READ', 'Source', sourceId, { read_at: at });
      const r = await upsert({ vertices: { Source: { [sourceId]: wrap({ read_at: at }) } }, edges });
      requireAccepted(`markRead ${sourceId}`, r, 1, 1);
    },

    async knownClaims(userId, embedding, maxDist) {
      const r = await query<{ known?: VertexJson<ClaimAttrs>[] }>('known_claims', {
        u: userParam(userId),
        claim_vec: embedding,
        max_dist: maxDist,
        k: KNOWN_CLAIMS_K,
      });
      return (r?.known ?? [])
        .map((v) => toMatch(v.attributes, v.attributes['@distance']))
        .sort((a, b) => a.distance - b.distance);
    },
    async addClaim(sourceId, claim) {
      if (!(await getVertex('Source', sourceId))) throw new TigerGraphError(`Unknown source ${sourceId}`);
      const edges: EdgeTree = {};
      edge(edges, 'Source', sourceId, 'MAKES', 'Claim', claim.id);
      const attrs = { text: claim.text, first_seen: claim.firstSeen, embedding: claim.embedding };
      const r = await upsert({ vertices: { Claim: { [claim.id]: wrap(attrs) } }, edges });
      requireAccepted(`addClaim ${claim.id}`, r, 1, 1);
    },
    async addRepeat(sourceId, claimId, text, distance) {
      const edges: EdgeTree = {};
      edge(edges, 'Source', sourceId, 'REPEATS', 'Claim', claimId, { text, distance });
      requireAccepted(`addRepeat ${sourceId} -> ${claimId}`, await upsert({ edges }), 0, 1);
    },
    async sourceClaims(userId, sourceId) {
      const r = await query<{ made: VertexJson<ClaimAttrs>[]; repeated: VertexJson<RepeatAttrs>[] }>('source_claims', {
        u: userParam(userId),
        src: sourceId,
      });
      if (!r) return { made: [], repeated: [] };
      const made = r.made
        .map((v) => ({ id: v.attributes.id, text: v.attributes.text }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      const repeated: RepeatedClaim[] = r.repeated
        .map((v) => ({ ...toMatch(v.attributes, v.attributes['@distance']), text: v.attributes['@repeat_text'] }))
        .sort((a, b) => a.claimId.localeCompare(b.claimId, undefined, { numeric: true }));
      return { made, repeated };
    },

    async listConcepts(userId): Promise<ConceptRecord[]> {
      const found = await withVectors('list_concepts', 'concepts', userId);
      return found.map((v) => ({ id: v.attributes.id, name: v.attributes.name, embedding: v.Embeddings.embedding }));
    },
    async upsertConcept(userId, concept, projectIds) {
      const edges: EdgeTree = {};
      edge(edges, 'User', userId, 'OWNS', 'Concept', concept.id);
      for (const p of projectIds) edge(edges, 'Concept', concept.id, 'RELEVANT_TO', 'Project', p);
      const attrs = { user_id: userId, name: concept.name, embedding: concept.embedding };
      const r = await upsert({ vertices: { Concept: { [concept.id]: wrap(attrs) } }, edges });
      requireAccepted(`upsertConcept ${concept.id}`, r, 1, 1 + projectIds.length);
    },
    async linkAbout(claimId, conceptId) {
      const edges: EdgeTree = {};
      edge(edges, 'Claim', claimId, 'ABOUT', 'Concept', conceptId);
      requireAccepted(`linkAbout ${claimId} -> ${conceptId}`, await upsert({ edges }), 0, 1);
    },

    async upsertProject(userId, project) {
      const edges: EdgeTree = {};
      edge(edges, 'User', userId, 'OWNS', 'Project', project.id);
      const attrs = { user_id: userId, name: project.name, description: project.description, embedding: project.embedding };
      const r = await upsert({ vertices: { Project: { [project.id]: wrap(attrs) } }, edges });
      requireAccepted(`upsertProject ${project.id}`, r, 1, 1);
    },
    async listProjects(userId): Promise<ProjectRecord[]> {
      const found = await withVectors('list_projects', 'projects', userId);
      return found.map((v) => ({
        id: v.attributes.id,
        name: v.attributes.name,
        description: v.attributes.description ?? '',
        embedding: v.Embeddings.embedding,
      }));
    },

    async learnNext(userId, limit): Promise<LearnNextItem[]> {
      const r = await query<{ result: VertexJson<LearnNextAttrs>[] }>('learn_next', { u: userParam(userId), lim: limit });
      return (r?.result ?? [])
        .map((v) => ({
          concept: v.attributes.name,
          project: v.attributes['@project'],
          unreadSources: [...v.attributes['@unread']].sort((a, b) => a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => b.unreadSources.length - a.unreadSources.length || a.concept.localeCompare(b.concept));
    },
    async neighborhood(userId, sourceId): Promise<Neighborhood> {
      type V = VertexJson<{ title?: string; text?: string; name?: string }>;
      const r = await query<{ source: V[]; claims: V[]; concepts: V[]; projects: V[]; links: EdgeJson[] }>(
        'neighborhood',
        { u: userParam(userId), src: sourceId },
      );
      if (!r || r.source.length === 0) return { nodes: [], links: [] };
      const links: GraphLink[] = r.links.map((e) => ({
        source: e.from_id,
        target: e.to_id,
        type: e.e_type as GraphLink['type'],
      }));
      const repeated = new Set(links.filter((l) => l.type === 'REPEATS').map((l) => l.target));
      const nodes: GraphNode[] = [
        ...r.source.map((v) => ({ id: v.v_id, type: 'Source' as const, label: v.attributes.title ?? '' })),
        ...r.claims.map((v) => ({
          id: v.v_id,
          type: 'Claim' as const,
          label: v.attributes.text ?? '',
          repeat: repeated.has(v.v_id),
        })),
        ...r.concepts.map((v) => ({ id: v.v_id, type: 'Concept' as const, label: v.attributes.name ?? '' })),
        ...r.projects.map((v) => ({ id: v.v_id, type: 'Project' as const, label: v.attributes.name ?? '' })),
      ];
      return { nodes, links };
    },

    async deleteUser(userId) {
      await query('delete_user', { u: userParam(userId) });
    },
  };
}

interface VectorStatus {
  status?: string;
  results?: { NeedRebuildServers?: string[] };
}

/**
 * Waits until the HNSW indexes on Claim, Concept and Project have caught up with upserts, so
 * `vectorSearch` sees them. Throws after `timeoutMs`.
 */
export async function waitForVectorIndex(timeoutMs = 60_000, config: TigerGraphConfig = tigerGraphConfigFromEnv()) {
  const deadline = Date.now() + timeoutMs;
  const ready = async (type: string) => {
    const res = await fetch(`${config.url}/restpp/vector/status/${config.graph}/${type}/embedding`);
    const body = (await res.json()) as VectorStatus;
    return body.status === 'Ready_for_query' && (body.results?.NeedRebuildServers ?? []).length === 0;
  };
  for (;;) {
    const states = await Promise.all(VECTOR_TYPES.map(ready));
    if (states.every(Boolean)) return;
    if (Date.now() > deadline) throw new TigerGraphError(`vector index not ready after ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
