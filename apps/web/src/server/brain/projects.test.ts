import { describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '../graph/port';
import { saveProjects } from './projects';

describe('saveProjects', () => {
  const setup = () => {
    const saved: { userId: string; project: ProjectRecord }[] = [];
    const graph = { upsertProject: async (userId: string, project: ProjectRecord) => void saved.push({ userId, project }) };
    return { saved, graph, embed: vi.fn(async (t: string[]) => t.map((_, i) => [i])) };
  };

  it('embeds each distinct name once, pairing vectors with names, trimmed and case-folded', async () => {
    const { saved, graph, embed } = setup();
    await saveProjects(graph, embed, 'u1', [' Thesis ', 'thesis', '', 'Job hunt']);
    expect(saved.map((s) => [s.project.name, s.project.embedding])).toEqual([['thesis', [0]], ['Job hunt', [1]]]);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('gives the same name the same id for one user and a different id for another', async () => {
    const { saved, graph, embed } = setup();
    await saveProjects(graph, embed, 'u1', ['Thesis']);
    await saveProjects(graph, embed, 'u1', ['thesis']);
    await saveProjects(graph, embed, 'u2', ['Thesis']);
    expect(saved[0]!.project.id).toBe(saved[1]!.project.id);
    expect(saved[2]!.project.id).not.toBe(saved[0]!.project.id);
    expect(saved[2]!.project.id.startsWith('u2::')).toBe(true);
  });
});
