export const STOPWORDS = new Set(
  `a an the and or but if then else of in on at to for from by with without about as into over under is are was were be been being am do does did done have has had having it its this that these those they them their there here he she his her we our you your i me my not no nor so than too very can could should would may might will shall just also more most some any each other such only own same what which who whom whose when where why how all both few many much one two new use used using`.split(
    /\s+/,
  ),
);

export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []).filter(
    (w) => w.length > 2 && !STOPWORDS.has(w),
  );
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}
