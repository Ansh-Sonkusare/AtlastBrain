import type { Project } from '../types';
import type { StepName } from './schemas';

export const MAX_INPUT_CHARS = 48_000;

export function truncateText(text: string): string {
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

const projectLines = (projects: Project[]) =>
  projects.length
    ? projects.map((p) => `- id=${p.id} | ${p.name}: ${p.description}`).join('\n')
    : '(none)';

export interface StepPrompt {
  step: StepName;
  system: string;
  user: string;
}

export function splitPrompt(text: string): StepPrompt {
  return {
    step: 'split',
    system:
      'You split a document into atomic, self-contained factual claims. Each claim is one sentence that makes sense without the document. Return 5 to 15 claims for an article and at least 1 for a short note. Skip filler, greetings and navigation text.',
    user: truncateText(text),
  };
}

export function linkPrompt(claims: string[], known: string[], projects: Project[]): StepPrompt {
  return {
    step: 'link',
    system:
      'For each claim give 1 or 2 short concept names (1 to 3 words each). Reuse a name from the known concepts list when it fits. claimIndex is the zero-based position of the claim.',
    user: `Known concepts:\n${known.length ? known.join('\n') : '(none)'}\n\nProjects:\n${projectLines(projects)}\n\nClaims:\n${claims.map((c, i) => `${i}: ${c}`).join('\n')}`,
  };
}

export function tldrPrompt(newClaims: string[], projects: Project[]): StepPrompt {
  return {
    step: 'tldr',
    system:
      'Write a TL;DR of only the new claims given. Return at most 3 short bullets, one sentence on why it matters, and the id of the single project it matters most for (null if none fits). Use a project id exactly as listed.',
    user: `Projects:\n${projectLines(projects)}\n\nNew claims:\n${newClaims.map((c) => `- ${c}`).join('\n')}`,
  };
}
