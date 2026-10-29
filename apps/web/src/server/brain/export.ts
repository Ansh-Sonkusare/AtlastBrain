import { strToU8, zipSync } from 'fflate';
import type { ExportConcept, ExportSource, GraphExport, Project, Tldr } from '../types';

const BAD_CHARS = /[\\/:*?"<>|#^[\]\u0000-\u001f]/g;
const MAX_NAME = 100;

/** A name that is safe as a file name and as a wikilink target. */
export function sanitizeName(raw: string): string {
  const name = raw.replace(BAD_CHARS, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').trim();
  return name.slice(0, MAX_NAME).trim() || 'Untitled';
}

/** One item per name, ignoring case: notes are keyed by name, and Obsidian links resolve by name. */
function firstByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => !seen.has(i.name.toLowerCase()) && !!seen.add(i.name.toLowerCase()));
}

/** Hands out names that are unique across the whole vault, ignoring case, so a bare `[[name]]` never clashes. */
function nameRegistry() {
  const taken = new Set<string>();
  return (raw: string): string => {
    const base = sanitizeName(raw);
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    taken.add(name.toLowerCase());
    return name;
  };
}

function link(file: string, label: string): string {
  const shown = label.replace(/[|[\]]/g, '').trim();
  return !shown || shown === file ? `[[${file}]]` : `[[${file}|${shown}]]`;
}

const quote = (text: string) => text.split('\n').map((l) => `> ${l}`).join('\n');

function tldrLines(tldr: Tldr): string[] {
  return [
    '## TL;DR',
    '',
    ...tldr.bullets.map((b) => `- ${b}`),
    ...(tldr.whyItMatters ? ['', `**Why it matters.** ${tldr.whyItMatters}`] : []),
    '',
  ];
}

export type Vault = Record<string, string>;

/** Markdown notes for Obsidian, keyed by path. Every wikilink target is the name of a file in the vault. */
export function buildVault(data: GraphExport): Vault {
  const unique = nameRegistry();
  const projects = firstByName(data.projects);
  const concepts = firstByName(data.concepts);
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));
  const sourceFile = new Map<string, string>(data.sources.map((s) => [s.id, unique(s.title || s.url)]));
  const projectFile = new Map<string, string>(projects.map((p) => [p.name.toLowerCase(), unique(p.name)]));
  const conceptFile = new Map<string, string>(concepts.map((c) => [c.name.toLowerCase(), unique(c.name)]));

  const conceptLink = (name: string) => {
    const file = conceptFile.get(name.toLowerCase());
    return file ? link(file, name) : name;
  };
  const projectLink = (name: string) => {
    const file = projectFile.get(name.toLowerCase());
    return file ? link(file, name) : name;
  };

  const sourcesByConcept = new Map<string, string[]>();
  for (const s of data.sources) {
    for (const key of new Set(s.made.flatMap((c) => c.concepts.map((n) => n.toLowerCase())))) {
      sourcesByConcept.set(key, [...(sourcesByConcept.get(key) ?? []), s.id]);
    }
  }

  const files: Vault = {};

  const sourceNote = (s: ExportSource): string => {
    const lines = [
      '---',
      `url: ${JSON.stringify(s.url)}`,
      `saved: ${s.savedAt}`,
      ...(s.readAt ? [`read: ${s.readAt}`] : []),
      '---',
      `# ${(s.title || s.url).replace(/\s+/g, ' ')}`,
      '',
    ];
    if (s.tldr) lines.push(...tldrLines(s.tldr));
    if (s.made.length) {
      lines.push('## New claims', '');
      for (const c of s.made) lines.push(`- ${[c.text, ...c.concepts.map(conceptLink)].join(' ')}`);
      lines.push('');
    }
    if (s.repeated.length) {
      lines.push('## Repeats', '');
      for (const r of s.repeated) {
        const file = sourceFile.get(r.sourceId);
        lines.push(`- ${r.text} (you read this in ${file ? link(file, r.sourceTitle) : r.sourceTitle})`);
      }
      lines.push('');
    }
    if (s.highlights.length) {
      lines.push('## Highlights', '', ...s.highlights.map((h) => `${quote(h)}\n`));
    }
    return lines.join('\n').trimEnd() + '\n';
  };

  const conceptNote = (c: ExportConcept): string => {
    const backlinks = (sourcesByConcept.get(c.name.toLowerCase()) ?? []).map((id) => {
      const s = sourceById.get(id)!;
      return `- ${link(sourceFile.get(id)!, s.title || s.url)}`;
    });
    const lines = [`# ${c.name}`, ''];
    if (c.summary) lines.push(c.summary, '');
    if (c.projects.length) lines.push('## Projects', '', ...c.projects.map((p) => `- ${projectLink(p)}`), '');
    if (backlinks.length) lines.push('## Sources', '', ...backlinks, '');
    return lines.join('\n').trimEnd() + '\n';
  };

  const projectNote = (p: Project): string => {
    const related = concepts.filter((c) => c.projects.some((n) => n.toLowerCase() === p.name.toLowerCase()));
    const lines = [`# ${p.name}`, ''];
    if (p.description) lines.push(p.description, '');
    if (related.length) lines.push('## Concepts', '', ...related.map((c) => `- ${conceptLink(c.name)}`), '');
    return lines.join('\n').trimEnd() + '\n';
  };

  for (const s of data.sources) files[`Sources/${sourceFile.get(s.id)}.md`] = sourceNote(s);
  for (const c of concepts) files[`Concepts/${conceptFile.get(c.name.toLowerCase())}.md`] = conceptNote(c);
  for (const p of projects) files[`Projects/${projectFile.get(p.name.toLowerCase())}.md`] = projectNote(p);
  return files;
}

export function zipVault(vault: Vault): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(vault).map(([name, md]) => [name, strToU8(md)])));
}
