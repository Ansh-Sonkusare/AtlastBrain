import { cosineDistance } from '../embed';
import type {
  ClaimMatch,
  GraphLink,
  GraphNode,
  LearnNextItem,
  Neighborhood,
  User,
} from '../types';
import type {
  ConceptRecord,
  GraphPort,
  NewClaim,
  ProjectRecord,
  SourceClaims,
  SourceRecord,
} from './port';

const KNOWN_CLAIMS_LIMIT = 5;

interface ClaimRow extends NewClaim {
  madeBy: string;
}

interface ConceptRow extends ConceptRecord {
  userId: string;
  projectIds: Set<string>;
}

/** In-process GraphPort for tests and the `GRAPH=memory` script. */
export function createMemoryGraph(): GraphPort {
  const users = new Map<string, User>();
  const sources = new Map<string, SourceRecord>();
  const webhookEvents = new Set<string>();
  const claims = new Map<string, ClaimRow>();
  const repeats = new Map<string, { claimId: string; text: string; distance: number }[]>();
  const reads = new Set<string>();
  const concepts = new Map<string, ConceptRow>();
  const about = new Map<string, Set<string>>();
  const projects = new Map<string, ProjectRecord & { userId: string }>();

  const readKey = (userId: string, sourceId: string) => `${userId}\u0000${sourceId}`;
  const isRead = (userId: string, sourceId: string) => reads.has(readKey(userId, sourceId));
  const ownedSource = (userId: string, sourceId: string) => {
    const s = sources.get(sourceId);
    return s && s.userId === userId ? s : null;
  };
  const conceptNames = (claimId: string) =>
    [...(about.get(claimId) ?? [])].map((id) => concepts.get(id)?.name).filter((n): n is string => !!n);
  const matchFor = (claim: ClaimRow, distance: number): ClaimMatch => {
    const src = sources.get(claim.madeBy)!;
    return {
      claimId: claim.id,
      claimText: claim.text,
      distance,
      sourceId: src.id,
      sourceTitle: src.title,
      sourceUrl: src.url,
      concepts: conceptNames(claim.id),
    };
  };
  const requireSource = (sourceId: string) => {
    const s = sources.get(sourceId);
    if (!s) throw new Error(`Unknown source ${sourceId}`);
    return s;
  };

  return {
    async ensureUser(userId, email) {
      let user = users.get(userId);
      if (!user) {
        user = { id: userId, email, plan: 'free', credits: 0, dodoCustomerId: '' };
        users.set(userId, user);
      }
      return { ...user };
    },
    async getUser(userId) {
      const user = users.get(userId);
      return user ? { ...user } : null;
    },
    async updateUser(userId, patch) {
      const user = users.get(userId);
      if (!user) throw new Error(`Unknown user ${userId}`);
      Object.assign(user, patch);
      return { ...user };
    },
    async countSavesSince(userId, since) {
      let n = 0;
      for (const s of sources.values()) if (s.userId === userId && s.savedAt >= since && s.status !== 'blocked') n++;
      return n;
    },

    async findUserByDodoCustomer(customerId) {
      for (const u of users.values()) if (u.dodoCustomerId === customerId) return { ...u };
      return null;
    },
    async recordWebhookEvent(eventId) {
      if (webhookEvents.has(eventId)) return false;
      webhookEvents.add(eventId);
      return true;
    },

    async findSource(userId, url, contentHash) {
      for (const s of sources.values()) {
        if (s.userId === userId && (s.url === url || s.contentHash === contentHash)) return { ...s };
      }
      return null;
    },
    async createSource(source) {
      sources.set(source.id, { ...source });
    },
    async getSource(userId, sourceId) {
      const s = ownedSource(userId, sourceId);
      return s ? { ...s } : null;
    },
    async updateSource(sourceId, patch) {
      Object.assign(requireSource(sourceId), patch);
    },
    async listPendingSources(limit) {
      return [...sources.values()]
        .filter((s) => s.status === 'pending')
        .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
        .slice(0, limit)
        .map((s) => ({ ...s }));
    },
    async listProcessingSources() {
      return [...sources.values()].filter((s) => s.status === 'processing').map((s) => ({ ...s }));
    },
    async listSourcesByStatus(userId, status) {
      return [...sources.values()]
        .filter((s) => s.userId === userId && s.status === status)
        .map((s) => ({ ...s }));
    },
    async markRead(userId, sourceId, at) {
      const s = ownedSource(userId, sourceId);
      if (!s) throw new Error(`Unknown source ${sourceId}`);
      reads.add(readKey(userId, sourceId));
      s.readAt = at;
    },

    async knownClaims(userId, embedding, maxDist) {
      const found: ClaimMatch[] = [];
      for (const c of claims.values()) {
        if (!isRead(userId, c.madeBy) || sources.get(c.madeBy)?.userId !== userId) continue;
        const distance = cosineDistance(embedding, c.embedding);
        if (distance < maxDist) found.push(matchFor(c, distance));
      }
      return found.sort((a, b) => a.distance - b.distance).slice(0, KNOWN_CLAIMS_LIMIT);
    },
    async addClaim(sourceId, claim) {
      requireSource(sourceId);
      claims.set(claim.id, { ...claim, madeBy: sourceId });
    },
    async addRepeat(sourceId, claimId, text, distance) {
      requireSource(sourceId);
      if (!claims.has(claimId)) throw new Error(`Unknown claim ${claimId}`);
      const list = repeats.get(sourceId) ?? [];
      if (!list.some((r) => r.claimId === claimId)) list.push({ claimId, text, distance });
      repeats.set(sourceId, list);
    },
    async sourceClaims(userId, sourceId): Promise<SourceClaims> {
      if (!ownedSource(userId, sourceId)) return { made: [], repeated: [] };
      const made = [...claims.values()]
        .filter((c) => c.madeBy === sourceId)
        .map((c) => ({ id: c.id, text: c.text }));
      const repeated = (repeats.get(sourceId) ?? []).map((r) => ({
        ...matchFor(claims.get(r.claimId)!, r.distance),
        text: r.text,
      }));
      return { made, repeated };
    },

    async listConcepts(userId) {
      return [...concepts.values()]
        .filter((c) => c.userId === userId)
        .map(({ id, name, embedding }) => ({ id, name, embedding }));
    },
    async upsertConcept(userId, concept, projectIds) {
      const row = concepts.get(concept.id);
      concepts.set(concept.id, {
        ...concept,
        userId,
        projectIds: new Set([...(row?.projectIds ?? []), ...projectIds]),
      });
    },
    async linkAbout(claimId, conceptId) {
      const set = about.get(claimId) ?? new Set<string>();
      set.add(conceptId);
      about.set(claimId, set);
    },

    async upsertProject(userId, project) {
      projects.set(project.id, { ...project, userId });
    },
    async listProjects(userId) {
      return [...projects.values()]
        .filter((p) => p.userId === userId)
        .map(({ userId: _u, ...p }) => p);
    },

    async learnNext(userId, limit) {
      const readSourceIds = (claimIds: string[]) =>
        claimIds.some((id) => {
          const made = claims.get(id)?.madeBy;
          if (made && isRead(userId, made)) return true;
          return [...repeats.entries()].some(([sid, list]) => list.some((r) => r.claimId === id) && isRead(userId, sid));
        });
      const items: LearnNextItem[] = [];
      for (const concept of concepts.values()) {
        if (concept.userId !== userId) continue;
        const project = [...concept.projectIds]
          .map((id) => projects.get(id))
          .find((p) => p && p.userId === userId);
        if (!project) continue;
        const claimIds = [...about.entries()].filter(([, set]) => set.has(concept.id)).map(([id]) => id);
        if (readSourceIds(claimIds)) continue;
        const unread = new Map<string, SourceRecord>();
        for (const id of claimIds) {
          const made = claims.get(id)?.madeBy;
          const src = made ? sources.get(made) : undefined;
          if (src && src.userId === userId && !isRead(userId, src.id)) unread.set(src.id, src);
        }
        items.push({
          concept: concept.name,
          project: project.name,
          unreadSources: [...unread.values()].map((s) => ({ id: s.id, title: s.title, url: s.url })),
        });
      }
      return items
        .sort((a, b) => b.unreadSources.length - a.unreadSources.length || a.concept.localeCompare(b.concept))
        .slice(0, limit);
    },

    async neighborhood(userId, sourceId): Promise<Neighborhood> {
      const src = ownedSource(userId, sourceId);
      if (!src) return { nodes: [], links: [] };
      const nodes = new Map<string, GraphNode>();
      const links: GraphLink[] = [];
      nodes.set(src.id, { id: src.id, type: 'Source', label: src.title });
      const addClaimTree = (claim: ClaimRow, type: 'MAKES' | 'REPEATS') => {
        nodes.set(claim.id, { id: claim.id, type: 'Claim', label: claim.text, repeat: type === 'REPEATS' });
        links.push({ source: src.id, target: claim.id, type });
        for (const conceptId of about.get(claim.id) ?? []) {
          const concept = concepts.get(conceptId);
          if (!concept) continue;
          nodes.set(concept.id, { id: concept.id, type: 'Concept', label: concept.name });
          links.push({ source: claim.id, target: concept.id, type: 'ABOUT' });
          for (const projectId of concept.projectIds) {
            const project = projects.get(projectId);
            if (!project || project.userId !== userId) continue;
            nodes.set(project.id, { id: project.id, type: 'Project', label: project.name });
            links.push({ source: concept.id, target: project.id, type: 'RELEVANT_TO' });
          }
        }
      };
      for (const c of claims.values()) if (c.madeBy === sourceId) addClaimTree(c, 'MAKES');
      for (const r of repeats.get(sourceId) ?? []) addClaimTree(claims.get(r.claimId)!, 'REPEATS');
      const seen = new Set<string>();
      const uniqueLinks = links.filter((l) => {
        const key = `${l.type}|${l.source}|${l.target}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { nodes: [...nodes.values()], links: uniqueLinks };
    },

    async deleteUser(userId) {
      users.delete(userId);
      for (const s of [...sources.values()]) {
        if (s.userId !== userId) continue;
        for (const [id, c] of claims) if (c.madeBy === s.id) { claims.delete(id); about.delete(id); }
        repeats.delete(s.id);
        reads.delete(readKey(userId, s.id));
        sources.delete(s.id);
      }
      for (const [id, c] of concepts) if (c.userId === userId) concepts.delete(id);
      for (const [id, p] of projects) if (p.userId === userId) projects.delete(id);
    },
  };
}
