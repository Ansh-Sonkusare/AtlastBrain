import type {
  CaptureSource,
  ClaimMatch,
  LearnNextItem,
  Neighborhood,
  Plan,
  Project,
  SourceStatus,
  Tldr,
  User,
} from '../types';

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
  countSavesSince(userId: string, since: string): Promise<number>;

  findSource(userId: string, url: string, contentHash: string): Promise<SourceRecord | null>;
  createSource(source: SourceRecord): Promise<void>;
  getSource(userId: string, sourceId: string): Promise<SourceRecord | null>;
  updateSource(
    sourceId: string,
    patch: Partial<Pick<SourceRecord, 'status' | 'newRatio' | 'tldr' | 'readAt' | 'title'>>,
  ): Promise<void>;
  listPendingSources(limit: number): Promise<SourceRecord[]>;
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

  deleteUser(userId: string): Promise<void>;
}

export type { Plan };
