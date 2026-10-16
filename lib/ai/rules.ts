import type { Adjustment, Reading, ReadingLine } from "@/lib/types";

/*
  A reader with no AI. It looks for the patterns café orders usually follow and leaves
  anything it can't read blank, so a person checks it on the review screen. It never
  guesses a quantity: if the number isn't clear, quantity is null and quantity_legible is false.
*/

const UNIT = "doz(?:en)?|trays?|loaves?|loaf|pcs|pieces?|kg|boxes?|packs?|bags?";
const QTY_FIRST = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*(?:[x×]\\s*)?(${UNIT})?\\s*(?:of\\s+)?(.+?)\\s*$`, "i");
const QTY_LAST = new RegExp(`^\\s*(.+?)\\s*[-:x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT})?\\s*$`, "i");
const ADJUST = /^\s*(add|remove|change)\s+(?:(\d+(?:\.\d+)?)\s+)?(.+?)\s*$/i;

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function firstMatch(lines: string[], re: RegExp) {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return { line: l, m };
  }
  return null;
}

export function readWithRules(text: string): Reading {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 0);

  const customer =
    firstMatch(lines, /^(?:from|customer|cafe|café|shop|name|business)\s*[:\-]\s*(.{2,80})$/i) ??
    firstMatch(lines, /^(?:order\s+from)\s+(.{2,80})$/i);
  const customer_name = customer ? clean(customer.m[1]) : lines[0]?.slice(0, 80) ?? "";
  const customer_quote = customer ? customer.line : "";

  const delivery = firstMatch(lines, /\b(?:deliver(?:y)?|for)\b.*\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\bdeliver(?:y)?\b\s*[:\-]?\s*(.{2,40})$/i);
  let delivery_text: string | null = null;
  if (delivery) {
    const day = delivery.line.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|tomorrow|today)\b/i);
    delivery_text = day ? day[1] : null;
  }

  const po = firstMatch(lines, /\b(?:po|p\.o\.|purchase order)\s*(?:number|no\.?|#)?\s*[:#]?\s*([a-z0-9][a-z0-9-]{1,30})\b/i);
  const po_number = po ? po.m[1] : null;

  const repeat = firstMatch(lines, /\bsame as (?:last|previous|usual|before)(?:\s+(?:week|month|order|time|day))?\b|\busual order\b|\bsame order\b/i);

  const adjustments: Adjustment[] = [];
  const lineItems: ReadingLine[] = [];
  for (const l of lines) {
    if (customer && l === customer.line) continue;
    if (repeat && l === repeat.line) continue;
    if (po && l === po.line) continue;
    if (delivery && l === delivery.line) continue;

    const adj = l.match(ADJUST);
    if (repeat && adj && !/^\d/.test(l)) {
      const op = adj[1].toLowerCase() as Adjustment["op"];
      adjustments.push({
        op,
        product_text: adj[3],
        quantity: adj[2] ? Number(adj[2]) : null,
        source_quote: l,
      });
      continue;
    }

    const first = l.match(QTY_FIRST);
    const last = first ? null : l.match(QTY_LAST);
    if (!first && !last) continue;

    const qtyText = first ? first[1] : last![2];
    const unit = (first ? first[2] : last![3]) ?? "";
    const product = first ? first[3] : last![1];
    const quantity = Number(qtyText);
    if (!Number.isFinite(quantity) || product.length < 2) continue;

    lineItems.push({
      raw_text: l,
      product_text: clean(product),
      quantity,
      unit_text: unit.toLowerCase(),
      quantity_legible: true,
      source_quote: l,
    });
  }

  return {
    customer_name,
    customer_quote,
    delivery_text,
    delivery_quote: delivery ? delivery.line : "",
    po_number,
    notes: null,
    repeat_previous: Boolean(repeat),
    repeat_quote: repeat ? repeat.m[0] : "",
    lines: lineItems,
    adjustments,
  };
}
