/** Lowercase, strip accents and punctuation, turn & into "and". */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ABBREVIATIONS: Record<string, string> = { lg: "large", lrg: "large", sm: "small", sml: "small", sd: "sourdough" };
const IRREGULAR: Record<string, string> = { loaves: "loaf" };
const STOP_WORDS = new Set(["the", "a", "an", "of", "please", "x", "pc", "pcs"]);

export function singular(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Normal form used to compare product names: "4 Sour Lg." and "sour large" become "sour large". */
export function normProduct(s: string): string {
  return norm(s)
    .split(" ")
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w)
    .map(singular)
    .filter((w) => !STOP_WORDS.has(w))
    .join(" ");
}
