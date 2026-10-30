import type {
  CaptureSource,
  ClaimMatch,
  GraphExport,
  Highlight,
  LearnNextItem,
  Neighborhood,
  Plan,
  Project,
  SourceStatus,
  Tldr,
  User,
} from '../types';

/** `pnpm --filter web demo:fill` saves quota placeholders under this url scheme. They count toward the quota only. */
export const isPlaceholder = (s: { url: string }) => s.url.startsWith('fill://');

export interface SourceRecord {
  id: string;
  userId: string;
  url: string;
  title: string;
  kind: CaptureSource;
  status: SourceStatus;
  savedAt: string;
  readAt: string | null;
  contentHash: string;
  body: string;
  newRatio: number;
  tldr: Tldr | null;
}

export interface NewClaim {
  id: string;
  text: string;
  embedding: number[];
  firstSeen: string;
}

export interface ConceptRecord {
  id: string;
  name: string;
  embedding: number[];
}

export interface ProjectRecord extends Project {
  embedding: number[];
}

/** A claim this source restated: `text` is the sentence in this source, `claimText` the original. */
export interface RepeatedClaim extends ClaimMatch {
  text: string;
}

export interface SourceClaims {
  made: { id: string; text: string }[];
  repeated: RepeatedClaim[];
}

/**
 * Every read and write the app makes against the graph. TigerGraph implements it in
 * `tigergraph.ts`; `memory.ts` is the in-process fake for tests. Every method that reads
 * user data takes the user id, so no query can run without one.
 */
export interface GraphPort {
  ensureUser(userId: string, email: string): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  updateUser(userId: string, patch: Partial<Pick<User, 'plan' | 'credits' | 'dodoCustomerId'>>): Promise<User>;
  /** Sources saved at or after `since`, not counting `blocked` ones (a blocked save used no quota). */
  countSavesSince(userId: string, since: string): Promise<number>;
  findUserByDodoCustomer(customerId: string): Promise<User | null>;
  /** Records a webhook id. Returns false when it was already recorded, so each event applies once. */
  recordWebhookEvent(eventId: string, at: string): Promise<boolean>;

  findSource(userId: string, url: string, contentHash: string): Promise<SourceRecord | null>;
  createSource(source: SourceRecord): Promise<void>;
  getSource(userId: string, sourceId: string): Promise<SourceRecord | null>;
  updateSource(
    sourceId: string,
    patch: Partial<Pick<SourceRecord, 'status' | 'newRatio' | 'tldr' | 'readAt' | 'title'>>,
  ): Promise<void>;
  listPendingSources(limit: number): Promise<SourceRecord[]>;
  /** Every user's sources stuck in `processing`. Only the single worker calls it, at start-up. */
  listProcessingSources(): Promise<SourceRecord[]>;
  listSourcesByStatus(userId: string, status: SourceStatus): Promise<SourceRecord[]>;
  markRead(userId: string, sourceId: string, at: string): Promise<void>;

  /** Nearest claims among sources this user has READ, nearest first, distance < maxDist. */
  knownClaims(userId: string, embedding: number[], maxDist: number): Promise<ClaimMatch[]>;
  addClaim(sourceId: string, claim: NewClaim): Promise<void>;
  addRepeat(sourceId: string, claimId: string, text: string, distance: number): Promise<void>;
  sourceClaims(userId: string, sourceId: string): Promise<SourceClaims>;

  listConcepts(userId: string): Promise<ConceptRecord[]>;
  upsertConcept(userId: string, concept: ConceptRecord, projectIds: string[]): Promise<void>;
  linkAbout(claimId: string, conceptId: string): Promise<void>;

  upsertProject(userId: string, project: ProjectRecord): Promise<void>;
  listProjects(userId: string): Promise<ProjectRecord[]>;

  learnNext(userId: string, limit: number): Promise<LearnNextItem[]>;
  neighborhood(userId: string, sourceId: string): Promise<Neighborhood>;

  /** Nearest claims among every claim the user's own sources made (OWNS → MAKES), nearest first. */
  searchClaims(userId: string, embedding: number[], k: number): Promise<ClaimMatch[]>;

  addHighlight(userId: string, highlight: Highlight): Promise<void>;
  listHighlights(userId: string, sourceId: string): Promise<Highlight[]>;

  exportGraph(userId: string): Promise<GraphExport>;

  deleteUser(userId: string): Promise<void>;
}

export type { Plan };
