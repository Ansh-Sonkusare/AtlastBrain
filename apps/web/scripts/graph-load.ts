import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tigerGraphConfigFromEnv } from '../src/server/graph/tigergraph';

const config = tigerGraphConfigFromEnv();
const graphDir = resolve(__dirname, '../../../graph');
const reset = process.argv.includes('--reset');

/** GSQL reports most failures as HTTP 200 with one of these phrases in the text. */
const FAILURE = /error|fail|could not|was expecting|not exist/i;
/** Lines that contain a FAILURE word but report success. */
const BENIGN = /succeeded: \d+, skipped: \d+, failed: 0|Successfully|Semantic Check Fails: Graph \w+ does not exist/;

async function gsql(script: string): Promise<string> {
  const res = await fetch(`${config.url}/gsql/v1/statements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Authorization: `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`,
      'GSQL-TIMEOUT': '1800000',
    },
    body: script,
    signal: AbortSignal.timeout(30 * 60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GSQL HTTP ${res.status}:\n${text}`);
  const bad = text.split('\n').filter((line) => FAILURE.test(line) && !BENIGN.test(line));
  if (bad.length > 0) throw new Error(`GSQL failed:\n${text}`);
  return text;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const out = await fn();
  console.log(`${label}: ${((Date.now() - start) / 1000).toFixed(1)} s`);
  return out;
}

/** The schema is complete once all three vector attributes exist (the last schema job). */
async function schemaState(): Promise<'missing' | 'complete' | 'partial'> {
  const graphs = await gsql('ls');
  if (!new RegExp(`- Graph ${config.graph}\\(`).test(graphs)) return 'missing';
  const ls = await gsql(`USE GRAPH ${config.graph}\nls`);
  const vectors = ls.split('Vector Embeddings:')[1] ?? '';
  return ['Claim', 'Concept', 'Project'].every((t) => vectors.includes(`- ${t}:`)) ? 'complete' : 'partial';
}

async function main() {
  const total = Date.now();
  console.log(`TigerGraph ${config.url}, graph ${config.graph}${reset ? ' (reset)' : ''}`);

  if (reset && (await schemaState()) !== 'missing') {
    await timed('drop graph', () => gsql(`DROP GRAPH ${config.graph} CASCADE`));
  }

  const state = await schemaState();
  if (state === 'partial') {
    throw new Error(`Graph ${config.graph} exists without its vector attributes. Rerun with --reset.`);
  }
  if (state === 'missing') {
    const schema = readFileSync(join(graphDir, 'schema.gsql'), 'utf8').replaceAll('SecondBrain', config.graph);
    await timed('create schema', () => gsql(schema));
  } else {
    console.log('schema: present, kept');
  }

  const queryDir = join(graphDir, 'queries');
  const files = readdirSync(queryDir).filter((f) => f.endsWith('.gsql')).sort();
  const names = files.map((f) => f.replace(/\.gsql$/, ''));
  const bodies = files.map((f) => readFileSync(join(queryDir, f), 'utf8').replaceAll('SecondBrain', config.graph));
  await timed(`create ${names.length} queries`, () => gsql(`USE GRAPH ${config.graph}\n${bodies.join('\n')}`));
  await timed(`install ${names.length} queries`, () =>
    gsql(`USE GRAPH ${config.graph}\nINSTALL QUERY ${names.join(', ')}`),
  );

  console.log(`done in ${((Date.now() - total) / 1000).toFixed(1)} s: ${names.join(', ')}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
