import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cosineDistance, embed } from '../src/server/embed';
import { createTigerGraph } from '../src/server/graph/tigergraph';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SEED_DIR = path.join(ROOT, 'fixtures/seed');

interface Pair { a: string; b: string; same: boolean }
interface Label { sentence: string; known: boolean; matches: string | null; matchSentence: string | null }

const load = <T>(file: string): T => JSON.parse(readFileSync(path.join(SEED_DIR, file), 'utf8')) as T;
const f3 = (n: number) => n.toFixed(3);

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { user: { type: 'string', default: 'demo' }, write: { type: 'boolean', default: true } } });
  const pairs = load<Pair[]>('pairs.json');
  const vecs = await embed(pairs.flatMap((p) => [p.a, p.b]));
  const rows = pairs.map((p, i) => ({ ...p, dist: cosineDistance(vecs[2 * i]!, vecs[2 * i + 1]!) })).sort((x, y) => x.dist - y.dist);

  const score = (t: number) => {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of rows) {
      const predicted = r.dist < t;
      if (predicted && r.same) tp++;
      else if (predicted) fp++;
      else if (r.same) fn++;
      else tn++;
    }
    return { t, tp, fp, fn, tn, accuracy: (tp + tn) / rows.length, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
  };
  const candidates = [0, ...rows.slice(1).map((r, i) => (rows[i]!.dist + r.dist) / 2), rows.at(-1)!.dist + 0.01];
  const scored = candidates.map(score);
  const bestAcc = Math.max(...scored.map((s) => s.accuracy));
  const ties = scored.filter((s) => s.accuracy === bestAcc);
  const lo = ties[0]!.t;
  const hi = ties.at(-1)!.t;
  const chosen = score(Math.round(((lo + hi) / 2) * 100) / 100);

  const sameDists = rows.filter((r) => r.same).map((r) => r.dist);
  const diffDists = rows.filter((r) => !r.same).map((r) => r.dist);
  const lines: string[] = [];
  lines.push('| dist | label | a | b |', '| --- | --- | --- | --- |');
  for (const r of rows) lines.push(`| ${f3(r.dist)} | ${r.same ? 'same' : 'different'} | ${r.a} | ${r.b} |`);
  const pairTable = lines.join('\n');

  const userId = values.user!;
  const graph = createTigerGraph();
  const labels = load<{ 'x402-overlap': { labels: Label[] } }>('demo.json')['x402-overlap'].labels;
  const sv = await embed(labels.map((l) => l.sentence));
  const demoRows: string[] = ['| # | labelled | predicted | nearest source | dist | ok | sentence |', '| --- | --- | --- | --- | --- | --- | --- |'];
  let correct = 0;
  for (const [i, l] of labels.entries()) {
    const [match] = await graph.knownClaims(userId, sv[i]!, chosen.t);
    const [near] = await graph.knownClaims(userId, sv[i]!, 1);
    const predicted = Boolean(match);
    const ok = predicted === l.known;
    if (ok) correct++;
    demoRows.push(`| ${i + 1} | ${l.known ? 'known' : 'new'} | ${predicted ? 'known' : 'new'} | ${near?.sourceTitle ?? '-'} | ${near ? f3(near.distance) : '-'} | ${ok ? 'yes' : 'NO'} | ${l.sentence} |`);
  }

  const summary = [
    `Pairs: ${rows.length} (${sameDists.length} same, ${diffDists.length} different).`,
    `Same-pair distance: min ${f3(Math.min(...sameDists))}, max ${f3(Math.max(...sameDists))}. Different-pair distance: min ${f3(Math.min(...diffDists))}, max ${f3(Math.max(...diffDists))}.`,
    `Best accuracy ${f3(bestAcc)}, reached for any threshold from ${f3(lo)} to ${f3(hi)}.`,
    `Chosen NOVELTY_MAX_DIST ${chosen.t} (middle of that range): accuracy ${f3(chosen.accuracy)}, precision ${f3(chosen.precision)}, recall ${f3(chosen.recall)} (TP ${chosen.tp}, FP ${chosen.fp}, FN ${chosen.fn}, TN ${chosen.tn}).`,
    `x402-overlap at ${chosen.t} against user ${userId}: ${correct} of ${labels.length} sentences right.`,
  ];
  console.log(summary.join('\n'));
  console.log('\n' + pairTable + '\n\n' + demoRows.join('\n'));

  if (values.write) {
    const doc = `# Novelty threshold

Written by \`pnpm --filter web tune\` (\`apps/web/scripts/tune-threshold.ts\`). Rerun it after you change the embedding model or the fixtures. Distance is cosine distance, \`1 - cosine similarity\`, from \`Xenova/all-MiniLM-L6-v2\`. A pair is predicted "same" when its distance is below the threshold.

## Result

${summary.map((s) => `- ${s}`).join('\n')}

## Labelled pairs, nearest first

${pairTable}

## x402-overlap against the seeded ${userId} user

Each sentence goes through \`knownClaims\` at the chosen threshold. "Nearest source" and "dist" come from the same query with no threshold, so a wrong prediction shows how far off it was.

${demoRows.join('\n')}
`;
    writeFileSync(path.join(ROOT, 'docs/threshold.md'), doc);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
