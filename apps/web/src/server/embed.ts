export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

// Same weights as EMBED_MODEL, served by the HF Inference router (feature-extraction pipeline).
const HF_URL =
  'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction';
const HF_BATCH = 32;
const HF_TIMEOUT_MS = 20_000;
const HF_RETRY_DELAY_MS = 2_000;

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): unknown }>;
let extractor: Promise<Extractor> | undefined;

function load(): Promise<Extractor> {
  // Dynamic import: only the requests that embed pay for loading ONNX.
  extractor ??= import('@huggingface/transformers').then((m) => {
    // A Vercel function can only write to /tmp; the model downloads there on a cold start.
    if (process.env.VERCEL) m.env.cacheDir = '/tmp/transformers';
    return m.pipeline('feature-extraction', EMBED_MODEL) as unknown as Extractor;
  });
  return extractor;
}

function provider(): 'local' | 'hf' {
  const p = process.env.EMBED_PROVIDER ?? (process.env.HF_TOKEN ? 'hf' : 'local');
  if (p !== 'local' && p !== 'hf') throw new Error(`EMBED_PROVIDER must be "local" or "hf", got "${p}"`);
  if (p === 'hf' && !process.env.HF_TOKEN) throw new Error('EMBED_PROVIDER=hf requires HF_TOKEN.');
  return p;
}

function normalize(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/** Sentence models return [n][384]; token-level [n][tokens][384] is mean-pooled just in case. */
function toVector(row: unknown): number[] {
  if (Array.isArray(row) && Array.isArray(row[0])) {
    const toks = row as number[][];
    return toks[0]!.map((_, i) => toks.reduce((s, t) => s + t[i]!, 0) / toks.length);
  }
  return row as number[];
}

async function hfBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(HF_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: texts, normalize: true, truncate: true }),
      signal: AbortSignal.timeout(HF_TIMEOUT_MS),
    });
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows) || rows.length !== texts.length) {
        throw new Error(`HF embeddings: expected ${texts.length} vectors, got ${Array.isArray(rows) ? rows.length : typeof rows}`);
      }
      return rows.map((r) => {
        const v = toVector(r);
        if (v.length !== EMBED_DIM) throw new Error(`HF embeddings: expected ${EMBED_DIM} dims, got ${v.length}`);
        return normalize(v);
      });
    }
    if (attempt === 0 && (res.status === 503 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, HF_RETRY_DELAY_MS));
      continue;
    }
    throw new Error(`HF embeddings failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (provider() === 'hf') {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += HF_BATCH) out.push(...(await hfBatch(texts.slice(i, i + HF_BATCH))));
    return out;
  }
  const model = await load();
  const out = await model(texts, { pooling: 'mean', normalize: true });
  return out.tolist() as number[][];
}

/** Vectors from `embed` are unit length, so cosine distance is 1 - dot. */
export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return 1 - dot;
}
