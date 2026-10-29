import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

function load(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline('feature-extraction', EMBED_MODEL) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
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
