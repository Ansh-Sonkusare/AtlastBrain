import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createLlm } from '../src/server/llm';
import { capture } from '../src/server/pipeline/capture';
import { createDeps } from '../src/server/pipeline/deps';
import { processSource } from '../src/server/pipeline/process';
import { getSaveResult } from '../src/server/pipeline/result';
import { selectGraph } from '../src/server/pipeline/select-graph';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string', default: 'demo' },
    url: { type: 'string' },
    title: { type: 'string' },
    source: { type: 'string', default: 'web' },
    'no-read': { type: 'boolean', default: false },
  },
});

async function main(): Promise<void> {
  const file = positionals[0];
  if (!file) {
    process.exitCode = 2;
    console.error('usage: tsx scripts/process-file.ts <file> [--user id] [--url u] [--title t] [--source extension|voice|web] [--no-read]');
    return;
  }

  const source = values.source as 'extension' | 'voice' | 'web';
  const userId = values.user!;
  const graph = await selectGraph(process.env.GRAPH ?? 'memory');
  const deps = createDeps({ graph, llm: createLlm() });

  await graph.ensureUser(userId, `${userId}@example.com`);
  const text = readFileSync(file, 'utf8');
  const { source: saved, duplicate } = await capture(deps, userId, {
    url: values.url ?? (source === 'voice' ? undefined : `file://${path.resolve(file)}`),
    title: values.title ?? path.basename(file),
    text,
    source,
  });
  if (!duplicate) await processSource(deps, userId, saved.id, { markRead: !values['no-read'] });
  console.log(JSON.stringify(await getSaveResult(deps, userId, saved.id), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
