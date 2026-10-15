import { norm } from "./normalize";

const SINGLE = new Set(["", "x", "each", "ea", "pc", "pcs", "piece", "pieces", "unit", "units", "loaf", "loaves", "qty"]);
const DOZEN = new Set(["doz", "dozen", "dozens", "dz"]);
const HALF_DOZEN = new Set(["half dozen", "half doz", "half a dozen"]);
const TRAY = new Set(["tray", "trays"]);

export type Conversion = { factor: number; kind: "none" | "converted" | "unknown" };

/** Turns a written unit into a count of single items. Unknown units are kept as-is and flagged. */
export function convert(unitText: string, pack: number): Conversion {
  const u = norm(unitText);
  if (SINGLE.has(u)) return { factor: 1, kind: "none" };
  if (DOZEN.has(u)) return { factor: 12, kind: "converted" };
  if (HALF_DOZEN.has(u)) return { factor: 6, kind: "converted" };
  if (TRAY.has(u)) return { factor: pack, kind: pack === 1 ? "none" : "converted" };
  return { factor: 1, kind: "unknown" };
}
