import { createHash } from 'node:crypto';
import type { GraphPort } from '../graph/port';

/** Saves projects by name. The id comes from the user and the name, so saving a name twice updates one project. */
export async function saveProjects(
  graph: Pick<GraphPort, 'upsertProject'>,
  embed: (texts: string[]) => Promise<number[][]>,
  userId: string,
  names: string[],
): Promise<void> {
  const unique = [...new Map(names.map((n) => n.trim()).filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];
  const vectors = await embed(unique);
  for (const [i, name] of unique.entries()) {
    const key = createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0, 24);
    await graph.upsertProject(userId, { id: `${userId}::${key}`, name, description: '', embedding: vectors[i]! });
  }
}
