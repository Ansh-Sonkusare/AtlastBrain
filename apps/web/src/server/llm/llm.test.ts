import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaimMatch, Project } from '../types';
import { buildAnthropicRequest, createAnthropicProvider, HAIKU, SONNET } from './anthropic';
import { assertUnderCap, CostCapError, priceUsd, recordCall, totalSpendUsd } from './cost';
import { createLlm } from './index';
import { buildOllamaRequest } from './ollama';
import { answerPrompt, explainPrompt, splitPrompt } from './prompts';
import { jsonSchemaFor } from './schemas';
import { stubProvider } from './stub';
import type { LlmProvider } from './types';

const ARTICLE = `Graph databases store relationships as first-class data. TigerGraph runs deep link analytics in parallel. Short one. Vector search finds claims with similar meaning! Does a traversal help novelty checks? Yes, it joins claims to the sources you have read.`;

const projects: Project[] = [
  { id: 'p-cook', name: 'Sourdough baking', description: 'bread starter flour hydration' },
  { id: 'p-brain', name: 'Second Brain', description: 'graph novelty claims vector search extension' },
];

describe('stub provider', () => {
  it('splits an article on sentence boundaries and drops short sentences', async () => {
    const { claims } = await stubProvider.splitClaims(ARTICLE);
    expect(claims).toEqual([
      'Graph databases store relationships as first-class data.',
      'TigerGraph runs deep link analytics in parallel.',
      'Vector search finds claims with similar meaning!',
      'Does a traversal help novelty checks?',
      'Yes, it joins claims to the sources you have read.',
    ]);
  });

  it('caps claims at 15', async () => {
    const text = Array.from({ length: 30 }, (_, i) => `Claim number ${i} has enough words.`).join(' ');
    expect((await stubProvider.splitClaims(text)).claims).toHaveLength(15);
  });

  it('links to the best known concept, else the two most frequent words', async () => {
    const { links } = await stubProvider.linkConcepts(
      ['Vector search finds similar claims.', 'Sourdough starters need regular feeding, feeding daily.'],
      ['Vector Search', 'Graph Theory'],
      projects,
    );
    expect(links[0]).toEqual({ claimIndex: 0, concepts: ['Vector Search'] });
    expect(links[1]!.claimIndex).toBe(1);
    expect(links[1]!.concepts).toEqual(['feeding', 'sourdough']);
  });

  it('writes a TL;DR from the first 3 new claims and names the matching project', async () => {
    const newClaims = ['Novelty checks use vector search over claims.', 'Graph traversal joins claims to sources.', 'Extension saves pages.', 'Fourth claim here now.'];
    const tldr = await stubProvider.writeTldr(newClaims, projects);
    expect(tldr.bullets).toEqual(newClaims.slice(0, 3));
    expect(tldr.projectId).toBe('p-brain');
    expect(tldr.whyItMatters).toContain('Second Brain');
  });

  it('returns a null project when nothing matches', async () => {
    const tldr = await stubProvider.writeTldr(['Completely unrelated astronomy facts appear.'], projects);
    expect(tldr.projectId).toBeNull();
  });
});

const match = (n: number): ClaimMatch => ({
  claimId: `c${n}`,
  claimText: `Claim number ${n} says something.`,
  distance: n / 10,
  sourceId: `s${n}`,
  sourceTitle: `Source ${n}`,
  sourceUrl: `https://example.com/${n}`,
  concepts: [],
});

describe('answer step', () => {
  it('stub answers extractively from the top claims and returns their ids', async () => {
    const res = await stubProvider.answer('what?', [1, 2, 3, 4].map(match));
    expect(res).toEqual({
      answer: 'Claim number 1 says something. Claim number 2 says something. Claim number 3 says something.',
      usedClaimIds: ['c1', 'c2', 'c3'],
    });
  });

  it('builds a prompt that restricts the answer to the given claims', () => {
    const p = answerPrompt('Why batch?', [match(1)]);
    expect(p.step).toBe('answer');
    expect(p.system).toMatch(/only the numbered claims/);
    expect(p.system).toMatch(/do not cover|not cover/);
    expect(p.user).toContain('Question: Why batch?');
    expect(p.user).toContain('- id=c1 | Claim number 1 says something. (from: Source 1)');
  });

  it('sends the anthropic answer request at low effort with its own schema', () => {
    const req = buildAnthropicRequest(answerPrompt('q', [match(1)]), HAIKU);
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: jsonSchemaFor('answer') } });
    expect(jsonSchemaFor('answer')).toMatchObject({ required: ['answer', 'usedClaimIds'], additionalProperties: false });
    expect(buildOllamaRequest(answerPrompt('q', [match(1)])).format).toEqual(jsonSchemaFor('answer'));
  });
});

describe('factory', () => {
  it('throws under VITEST for non-stub profiles', () => {
    expect(process.env.VITEST).toBeTruthy();
    for (const p of ['demo', 'cheap', 'local']) expect(() => createLlm(p)).toThrow(/not allowed under test/);
  });
  it('returns the stub for stub', () => {
    expect(createLlm('stub')).toBe(stubProvider);
  });
});

describe('cost guard', () => {
  let dir: string;
  const saved = { log: process.env.COST_LOG, cap: process.env.COST_CAP_USD };
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cost-'));
    process.env.COST_LOG = path.join(dir, 'nested', 'cost.jsonl');
    delete process.env.COST_CAP_USD;
  });
  afterEach(() => {
    if (saved.log === undefined) delete process.env.COST_LOG; else process.env.COST_LOG = saved.log;
    if (saved.cap === undefined) delete process.env.COST_CAP_USD; else process.env.COST_CAP_USD = saved.cap;
  });

  it('prices calls per million tokens', () => {
    expect(priceUsd(HAIKU, 1_000_000, 1_000_000)).toBeCloseTo(0.6);
    expect(priceUsd(SONNET, 1_000_000, 1_000_000)).toBeCloseTo(12);
  });

  it('appends entries and refuses past the cap', () => {
    assertUnderCap();
    const e = recordCall({ step: 'split', model: SONNET, inputTokens: 1_000_000, outputTokens: 0 });
    expect(e.usd).toBe(2);
    expect(totalSpendUsd()).toBe(2);
    assertUnderCap();
    process.env.COST_CAP_USD = '2';
    expect(() => assertUnderCap()).toThrow(CostCapError);
    const line = JSON.parse(readFileSync(process.env.COST_LOG!, 'utf8').trim());
    expect(Object.keys(line).sort()).toEqual(['inputTokens', 'model', 'outputTokens', 'step', 'ts', 'usd']);
  });

  it('defaults the cap to 5 dollars', () => {
    recordCall({ step: 'tldr', model: SONNET, inputTokens: 2_500_000, outputTokens: 0 });
    expect(() => assertUnderCap()).toThrow(CostCapError);
  });

  it('falls back to ollama and does not call the API once capped', async () => {
    process.env.COST_CAP_USD = '0';
    let apiCalls = 0;
    const fallback: LlmProvider = { ...stubProvider, splitClaims: async () => ({ claims: ['from fallback'] }) };
    const logs: string[] = [];
    const provider = createAnthropicProvider({
      models: { split: HAIKU, link: HAIKU, tldr: HAIKU, answer: HAIKU, explain: HAIKU },
      fallback,
      client: { messages: { create: async () => { apiCalls++; throw new Error('should not run'); } } } as never,
      log: (l) => logs.push(l),
    });
    expect(await provider.splitClaims('x')).toEqual({ claims: ['from fallback'] });
    expect(apiCalls).toBe(0);
    expect(logs[0]).toMatch(/falling back to ollama/);
  });

  it('parses a response and logs its cost', async () => {
    const create = async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ claims: ['a b c d'] }) }],
      usage: { input_tokens: 1000, output_tokens: 100 },
    });
    const provider = createAnthropicProvider({
      models: { split: HAIKU, link: HAIKU, tldr: HAIKU, answer: HAIKU, explain: HAIKU },
      fallback: stubProvider,
      client: { messages: { create } } as never,
    });
    expect(await provider.splitClaims('text')).toEqual({ claims: ['a b c d'] });
    expect(totalSpendUsd()).toBeCloseTo(0.00015);
  });

  it('parses an anthropic answer and logs its cost', async () => {
    const create = async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ answer: 'Because.', usedClaimIds: ['c1'] }) }],
      usage: { input_tokens: 1000, output_tokens: 100 },
    });
    const provider = createAnthropicProvider({
      models: { split: HAIKU, link: HAIKU, tldr: HAIKU, answer: HAIKU, explain: HAIKU },
      fallback: stubProvider,
      client: { messages: { create } } as never,
    });
    expect(await provider.answer('q', [match(1)])).toEqual({ answer: 'Because.', usedClaimIds: ['c1'] });
    expect(totalSpendUsd()).toBeCloseTo(0.00015);
  });
});

describe('request builders', () => {
  it('builds the anthropic request with low effort, json schema and truncated text', () => {
    const long = 'x'.repeat(60_000);
    const req = buildAnthropicRequest(splitPrompt(long), SONNET);
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: jsonSchemaFor('split') } });
    expect(req.messages).toHaveLength(1);
    expect((req.messages[0]!.content as string).length).toBe(48_000);
    expect(req).not.toHaveProperty('temperature');
    expect(req).not.toHaveProperty('tool_choice');
    expect(req.max_tokens).toBeGreaterThan(0);
  });

  it('shares one json schema per step', () => {
    expect(jsonSchemaFor('tldr')).toMatchObject({
      type: 'object',
      required: ['bullets', 'whyItMatters', 'projectId'],
      additionalProperties: false,
    });
    expect(jsonSchemaFor('split')).not.toHaveProperty('$schema');
  });

  it('builds the ollama request', () => {
    const req = buildOllamaRequest(splitPrompt('hello there friend of mine'));
    expect(req).toMatchObject({ model: 'qwen3:8b', think: false, stream: false });
    expect(req.options.num_ctx).toBeGreaterThanOrEqual(12288);
    expect(req.format).toEqual(jsonSchemaFor('split'));
  });
  it('sends no integer bounds, which Claude structured output rejects', () => {
    for (const step of ['split', 'link', 'tldr', 'answer', 'explain'] as const) {
      expect(JSON.stringify(jsonSchemaFor(step))).not.toMatch(/"(minimum|maximum)"/);
    }
  });
});

describe('explain step', () => {
  const node = { type: 'Concept', label: 'Vector Search' } as const;
  const near = [
    { type: 'Claim', label: 'Vector search finds similar claims.' },
    { type: 'Project', label: 'Second Brain' },
  ] as const;

  it('stub explains deterministically from the node and its neighbors', async () => {
    const res = await stubProvider.explainNode(node, [...near]);
    expect(res).toEqual(await stubProvider.explainNode(node, [...near]));
    expect(res.explanation).toContain('Vector Search');
    expect(res.explanation).toContain('Second Brain');
    expect((await stubProvider.explainNode(node, [])).explanation).toContain('no connections');
  });

  it('prompt lists the node, caps neighbors at 30 and truncates long labels', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ type: 'Claim' as const, label: `c${i} ${'x'.repeat(500)}` }));
    const p = explainPrompt(node, many);
    expect(p.step).toBe('explain');
    expect(p.user).toContain('Node (Concept): Vector Search');
    expect(p.user.match(/^- Claim:/gm)).toHaveLength(30);
    expect(p.user).not.toContain('x'.repeat(400));
  });
});
