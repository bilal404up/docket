import type { MatchMethod } from "@/lib/types";
import { norm, normProduct } from "./normalize";
import { similarity } from "./trigram";

export type CatalogAlias = { id?: string; alias: string; customerId: string | null; source: "seed" | "learned" };
export type CatalogProduct = { id: string; sku: string; name: string; pack: number; dough: string; aliases: CatalogAlias[] };
export type ProductMatch = { productId: string | null; method: MatchMethod; score: number | null };

const FUZZY_MIN = 0.5;
const FUZZY_LEAD = 0.15;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
  Matches written product text to the catalog, in order: exact name or SKU, an alias this
  café has taught Docket, a shared alias, then trigram similarity with a clear lead over
  the next product. Anything else is left unmatched for a person to decide.
*/
export function matchProduct(text: string, customerId: string | null, catalog: CatalogProduct[]): ProductMatch {
  const n = normProduct(text);
  if (!n) return { productId: null, method: "none", score: null };

  for (const p of catalog) {
    if (normProduct(p.name) === n || norm(p.sku) === norm(text)) return { productId: p.id, method: "exact", score: 1 };
  }
  if (customerId) {
    for (const p of catalog) {
      if (p.aliases.some((a) => a.customerId === customerId && normProduct(a.alias) === n)) {
        return { productId: p.id, method: "learned", score: 1 };
      }
    }
  }
  for (const p of catalog) {
    const hit = p.aliases.find((a) => a.customerId === null && normProduct(a.alias) === n);
    if (hit) return { productId: p.id, method: hit.source === "learned" ? "learned" : "alias", score: 1 };
  }

  const scored = catalog
    .map((p) => {
      const names = [p.name, ...p.aliases.filter((a) => a.customerId === null || a.customerId === customerId).map((a) => a.alias)];
      return { id: p.id, score: Math.max(...names.map((x) => similarity(n, normProduct(x)))) };
    })
    .sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  if (best && best.score >= FUZZY_MIN && best.score - (second?.score ?? 0) >= FUZZY_LEAD) {
    return { productId: best.id, method: "fuzzy", score: round2(best.score) };
  }
  return { productId: null, method: "none", score: best ? round2(best.score) : null };
}
