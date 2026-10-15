/** Trigram similarity in the style of Postgres pg_trgm: shared trigrams over all trigrams. */
function trigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (const word of s.split(" ").filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((g) => {
    if (B.has(g)) shared++;
  });
  return shared / (A.size + B.size - shared);
}
