export type CaptureSource = 'extension' | 'voice' | 'web';

export interface CapturePayload {
  url: string;
  title: string;
  text: string;
  selection?: string;
  source: CaptureSource;
  capturedAt?: string;
}

export type SourceStatus = 'pending' | 'processing' | 'done' | 'partial' | 'blocked';
export type Plan = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  plan: Plan;
  credits: number;
  dodoCustomerId: string;
}

export interface ClaimMatch {
  claimId: string;
  claimText: string;
  distance: number;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  concepts: string[];
}

export type ClaimVerdict =
  | { kind: 'new'; text: string; claimId: string }
  | { kind: 'repeat'; text: string; match: ClaimMatch };

export interface Tldr {
  bullets: string[];
  whyItMatters: string;
  projectId: string | null;
}

export interface SaveResult {
  sourceId: string;
  status: SourceStatus;
  title: string;
  url: string;
  newRatio: number;
  verdicts: ClaimVerdict[];
  tldr: Tldr | null;
  blockedReason?: 'quota';
}

export interface LearnNextItem {
  concept: string;
  project: string;
  unreadSources: { id: string; title: string; url: string }[];
}

export interface GraphNode {
  id: string;
  type: 'Source' | 'Claim' | 'Concept' | 'Project';
  label: string;
  repeat?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'MAKES' | 'REPEATS' | 'ABOUT' | 'RELEVANT_TO';
}

export interface Neighborhood {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface CaptureResponse {
  sourceId: string;
  status: 'pending' | 'done' | 'blocked';
  checkoutUrl?: string;
  reason?: 'quota';
}

export interface MeResponse {
  user: User;
  usage: { used: number; limit: number; credits: number };
}

export interface Settings {
  apiBase: string;
  userId: string;
}
