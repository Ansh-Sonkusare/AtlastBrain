import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const GSQL_QUERIES = ['known_claims', 'search_claims', 'learn_next', 'neighborhood'] as const;

function queriesDir(): string {
  return process.env.GSQL_DIR ?? path.resolve(process.cwd(), '../../graph/queries');
}

/** The text of an allow-listed query, or null for any other name or a missing file. */
export async function readGsql(name: string): Promise<string | null> {
  if (!(GSQL_QUERIES as readonly string[]).includes(name)) return null;
  try {
    return await readFile(path.join(queriesDir(), `${name}.gsql`), 'utf8');
  } catch {
    return null;
  }
}
