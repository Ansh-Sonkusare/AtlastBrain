import type { z } from 'zod';
import { STEP_SCHEMAS, jsonSchemaFor } from './schemas';
import { answerPrompt, linkPrompt, splitPrompt, tldrPrompt, truncateText, type StepPrompt } from './prompts';
import type { LlmProvider } from './types';

export const OLLAMA_MODEL = 'qwen3:8b';
export const OLLAMA_NUM_CTX = 12288;

export function buildOllamaRequest(p: StepPrompt, model: string = OLLAMA_MODEL) {
  return {
    model,
    stream: false,
    think: false,
    // Keep the 5 GB model on the GPU between saves; a cold load adds tens of seconds.
    keep_alive: '30m',
    format: jsonSchemaFor(p.step),
    options: { num_ctx: OLLAMA_NUM_CTX, temperature: 0 },
    messages: [
      { role: 'system', content: p.system },
      { role: 'user', content: p.user },
    ],
  };
}

export function createOllamaProvider(opts: { url?: string; model?: string; fetch?: typeof fetch } = {}): LlmProvider {
  const base = opts.url ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  const doFetch = opts.fetch ?? fetch;
  const model = opts.model ?? process.env.OLLAMA_MODEL ?? OLLAMA_MODEL;

  async function run<S extends keyof typeof STEP_SCHEMAS>(p: StepPrompt & { step: S }) {
    const res = await doFetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildOllamaRequest(p, model)),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { message?: { content?: string } };
    return STEP_SCHEMAS[p.step].parse(JSON.parse(body.message?.content ?? '')) as z.infer<(typeof STEP_SCHEMAS)[S]>;
  }

  return {
    splitClaims: (text) => run({ ...splitPrompt(truncateText(text)), step: 'split' }),
    linkConcepts: (c, k, pr) => run({ ...linkPrompt(c, k, pr), step: 'link' }),
    writeTldr: (n, pr) => run({ ...tldrPrompt(n, pr), step: 'tldr' }),
    answer: (q, claims) => run({ ...answerPrompt(q, claims), step: 'answer' }),
  };
}
