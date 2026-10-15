import type { Page, Rule, Run } from "@/lib/types";

export const LETTER = { width: 612, height: 792 };

/** A piece of text on a page, in points from the top-left corner. */
export type Text = { x: number; y: number; t: string; s?: number; b?: boolean };
export type RuleSpec = [number, number, number, number];

/* Rough Helvetica widths in ems. The viewer stretches each run to exactly this
   width, so highlight boxes always line up with the text drawn on screen. */
function em(ch: string): number {
  if (ch === " ") return 0.278;
  if (/[il.,:;'|!·]/.test(ch)) return 0.25;
  if (/[fjrt\-()]/.test(ch)) return 0.34;
  if (/[mw]/.test(ch)) return 0.83;
  if (/[MW]/.test(ch)) return 0.85;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.556;
  return 0.53;
}

export function textWidth(t: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of t) w += em(ch);
  return w * size * (bold ? 1.06 : 1);
}

export function makePage(texts: Text[], rules: RuleSpec[] = [], size = LETTER): Page {
  const { width: W, height: H } = size;
  const runs: Run[] = texts.map(({ x, y, t, s = 10, b = false }) => ({
    t,
    x: x / W,
    y: y / H,
    w: textWidth(t, s, b) / W,
    h: (s * 1.25) / H,
    s,
    b,
  }));
  const lines: Rule[] = rules.map(([x1, y1, x2, y2]) => ({ x1: x1 / W, y1: y1 / H, x2: x2 / W, y2: y2 / H }));
  return { width: W, height: H, runs, rules: lines };
}

/** A simple order table: bold header, a rule, body rows, a closing rule. */
export function table(top: number, cols: number[], header: string[], rows: string[][], gap = 20) {
  const texts: Text[] = header.map((t, i) => ({ x: cols[i], y: top, t, s: 10, b: true }));
  const rules: RuleSpec[] = [[cols[0], top + 17, 556, top + 17]];
  rows.forEach((row, r) => row.forEach((t, i) => texts.push({ x: cols[i], y: top + 27 + r * gap, t, s: 11 })));
  const bottom = top + 27 + rows.length * gap;
  rules.push([cols[0], bottom, 556, bottom]);
  return { texts, rules, bottom };
}
