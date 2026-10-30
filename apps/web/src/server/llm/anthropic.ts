import Anthropic from '@anthropic-ai/sdk';
import { assertUnderCap, CostCapError, recordCall } from './cost';
import { answerPrompt, explainPrompt, linkPrompt, splitPrompt, tldrPrompt, truncateText, type StepPrompt } from './prompts';
import { STEP_SCHEMAS, jsonSchemaFor, type StepName } from './schemas';
import type { LlmProvider } from './types';

export const HAIKU = 'claude-haiku-5-5';
export const SONNET = 'claude-sonnet-5-5';

export function buildAnthropicRequest(p: StepPrompt, model: string): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: 4096,
    system: p.system,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: jsonSchemaFor(p.step) } },
    messages: [{ role: 'user', content: p.user }],
  };
}

const SPEND_LIMIT = /spend(ing)? limit|usage limit|cost cap|credit balance/i;

export function isSpendLimitError(e: unknown): boolean {
  if (e instanceof CostCapError) return true;
  return e instanceof Anthropic.APIError && SPEND_LIMIT.test(e.message);
}

export interface AnthropicProviderOptions {
  models: Record<StepName, string>;
  fallback: LlmProvider;
  client?: Pick<Anthropic, 'messages'>;
  log?: (line: string) => void;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): LlmProvider {
  const log = opts.log ?? ((l) => console.warn(l));
  let client = opts.client;

  async function run<S extends StepName>(p: StepPrompt & { step: S }, fallback: () => Promise<unknown>) {
    const model = opts.models[p.step];
    try {
      assertUnderCap();
      client ??= new Anthropic();
      const res = await client.messages.create(buildAnthropicRequest(p, model));
      recordCall({
        step: p.step,
        model,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      });
      if (res.stop_reason === 'refusal') throw new Error(`anthropic refused step ${p.step}`);
      const block = res.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') throw new Error(`anthropic returned no text for step ${p.step}`);
      return STEP_SCHEMAS[p.step].parse(JSON.parse(block.text));
    } catch (e) {
      if (!isSpendLimitError(e)) throw e;
      log(`anthropic spend limit hit on step ${p.step} (${(e as Error).message}); falling back to ollama`);
      return fallback();
    }
  }

  const fb = opts.fallback;
  return {
    splitClaims: (text) =>
      run({ ...splitPrompt(truncateText(text)), step: 'split' }, () => fb.splitClaims(text)) as ReturnType<LlmProvider['splitClaims']>,
    linkConcepts: (c, k, pr) =>
      run({ ...linkPrompt(c, k, pr), step: 'link' }, () => fb.linkConcepts(c, k, pr)) as ReturnType<LlmProvider['linkConcepts']>,
    writeTldr: (n, pr) =>
      run({ ...tldrPrompt(n, pr), step: 'tldr' }, () => fb.writeTldr(n, pr)) as ReturnType<LlmProvider['writeTldr']>,
    answer: (q, claims) =>
      run({ ...answerPrompt(q, claims), step: 'answer' }, () => fb.answer(q, claims)) as ReturnType<LlmProvider['answer']>,
    explainNode: (n, nb) =>
      run({ ...explainPrompt(n, nb), step: 'explain' }, () => fb.explainNode(n, nb)) as ReturnType<LlmProvider['explainNode']>,
  };
}
