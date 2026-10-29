import { z } from 'zod';

export const CaptureSource = z.enum(['extension', 'voice', 'web']);
export type CaptureSource = z.infer<typeof CaptureSource>;

export const CapturePayload = z.object({
  url: z.string().min(1),
  title: z.string().default(''),
  text: z.string().min(1),
  selection: z.string().optional(),
  source: CaptureSource,
  capturedAt: z.string().datetime().optional(),
});
export type CapturePayload = z.infer<typeof CapturePayload>;

export type SourceStatus = 'pending' | 'processing' | 'done' | 'partial' | 'blocked';
export type Plan = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  plan: Plan;
  credits: number;
  dodoCustomerId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
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

export interface Highlight {
  id: string;
  sourceId: string;
  text: string;
  createdAt: string;
}

/** Ask the brain: an answer built only from the user's own claims, with the claims it used. */
export interface BrainAnswer {
  question: string;
  answer: string;
  citations: ClaimMatch[];
}

export interface ExportSource {
  id: string;
  title: string;
  url: string;
  savedAt: string;
  readAt: string | null;
  tldr: Tldr | null;
  made: { id: string; text: string; concepts: string[] }[];
  repeated: { claimId: string; text: string; claimText: string; sourceId: string; sourceTitle: string }[];
  highlights: string[];
}

export interface ExportConcept {
  id: string;
  name: string;
  summary: string;
  projects: string[];
}

/** Everything one user owns, shaped for the Obsidian export. */
export interface GraphExport {
  projects: Project[];
  concepts: ExportConcept[];
  sources: ExportSource[];
}

export interface Neighborhood {
  nodes: GraphNode[];
  links: GraphLink[];
}
