import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class CostCapError extends Error {
  constructor(public spent: number, public cap: number) {
    super(`Cost cap reached: spent $${spent.toFixed(4)} of $${cap}`);
    this.name = 'CostCapError';
  }
}

/** USD per million tokens. */
export const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
};

export interface CostEntry {
  ts: string;
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export function priceUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for model ${model}`);
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

export function costLogPath(): string {
  return process.env.COST_LOG ?? path.join(repoRoot, 'logs', 'cost.jsonl');
}

export function costCapUsd(): number {
  const raw = process.env.COST_CAP_USD;
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : 5;
}

export function totalSpendUsd(file = costLogPath()): number {
  if (!existsSync(/* turbopackIgnore: true */ file)) return 0;
  let sum = 0;
  for (const line of readFileSync(/* turbopackIgnore: true */ file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    sum += (JSON.parse(line) as CostEntry).usd;
  }
  return sum;
}

export function assertUnderCap(): void {
  const spent = totalSpendUsd();
  const cap = costCapUsd();
  if (spent >= cap) throw new CostCapError(spent, cap);
}

export function recordCall(e: Omit<CostEntry, 'ts' | 'usd'>): CostEntry {
  const entry: CostEntry = {
    ts: new Date().toISOString(),
    ...e,
    usd: priceUsd(e.model, e.inputTokens, e.outputTokens),
  };
  const file = costLogPath();
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + '\n');
  return entry;
}
