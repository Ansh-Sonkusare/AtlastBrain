import { describe, expect, it } from 'vitest';
import { createMemoryGraph } from './graph/memory';
import type { SourceRecord } from './graph/port';
import { stubProvider } from './llm/stub';
import { createDeps } from './pipeline/deps';
import { drainPending, requeueStuck } from './worker';

function source(id: string, status: SourceRecord['status']): SourceRecord {
  return {
    id, userId: 'u1', url: `https://example.com/${id}`, title: id, kind: 'web', status,
    savedAt: new Date().toISOString(), readAt: null, contentHash: id, body: 'One short claim sentence here. Another short claim sentence here.',
    newRatio: 0, tldr: null,
  };
}

describe('worker', () => {
  it('re-queues sources a dead worker left in processing', async () => {
    const graph = createMemoryGraph();
    await graph.ensureUser('u1', 'u@example.com');
    await graph.createSource(source('a', 'processing'));
    await graph.createSource(source('b', 'done'));
    expect(await requeueStuck(createDeps({ graph, llm: stubProvider }))).toBe(1);
    expect((await graph.getSource('u1', 'a'))!.status).toBe('pending');
    expect((await graph.getSource('u1', 'b'))!.status).toBe('done');
  });

  it('keeps going when one source throws before processing starts', async () => {
    const graph = createMemoryGraph();
    await graph.ensureUser('u1', 'u@example.com');
    await graph.createSource(source('bad', 'pending'));
    await graph.createSource(source('good', 'pending'));
    const getSource = graph.getSource.bind(graph);
    graph.getSource = async (userId, id) => {
      if (id === 'bad') throw new Error('graph down for this one');
      return getSource(userId, id);
    };
    const deps = createDeps({ graph, llm: stubProvider, embed: async (t) => t.map(() => Array(384).fill(0.05)) });
    expect(await drainPending(deps)).toBe(2);
    expect((await getSource('u1', 'good'))!.status).toBe('done');
  });
});
