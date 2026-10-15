import type { FlagCode, MatchMethod, Reading, Severity, SourceRef, TextLayer } from "@/lib/types";
import {
  cutoffFor, daysList, fmtDay, fmtTime, nextServed, nextServedAfter, parseDelivery, toDateStr, weekday, weekdayName,
} from "./dates";
import { locate } from "./locate";
import { matchProduct, type CatalogProduct } from "./match";
import { norm } from "./normalize";
import { similarity } from "./trigram";
import { convert } from "./units";

export type CustomerCtx = { id: string; name: string; short: string; aliases: string[]; days: number[] };
export type PastOrder = { orderId: string; label: string; date: string; lines: { productId: string; qty: number }[] };
export type ExistingOrder = { orderId: string; customerId: string; date: string; signature: string; label: string };

export type Ctx = {
  receivedAt: Date;
  now: Date;
  cutoffHour: number;
  customers: CustomerCtx[];
  catalog: CatalogProduct[];
  usual(customerId: string, productId: string): number | null;
  lastWeek(customerId: string, date: string): PastOrder | null;
  existing: ExistingOrder[];
};

export type DraftLine = {
  lineNo: number;
  rawText: string;
  productText: string;
  productId: string | null;
  qty: number | null;
  unitRaw: string;
  qtyEach: number | null;
  method: MatchMethod;
  score: number | null;
  source: SourceRef;
};

export type DraftFlag = {
  code: FlagCode;
  severity: Severity;
  message: string;
  lineNo: number | null;
  data: Record<string, unknown>;
};

export type Draft = {
  customerId: string | null;
  customerRaw: string;
  customerRef: SourceRef;
  deliveryDate: string | null;
  deliveryReason: string;
  deliveryRef: SourceRef;
  poNumber: string | null;
  notes: string | null;
  lines: DraftLine[];
  flags: DraftFlag[];
  duplicateOf: string | null;
  signature: string;
};

/** Order fingerprint used to spot resends: product and quantity pairs, sorted. */
export function signatureOf(lines: { productId: string | null; qtyEach: number | null }[]): string {
  return lines
    .filter((l) => l.productId && l.qtyEach)
    .map((l) => `${l.productId}:${l.qtyEach}`)
    .sort()
    .join("|");
}

export function matchCustomer(name: string, customers: CustomerCtx[]): CustomerCtx | null {
  const n = norm(name);
  if (!n) return null;
  const exact = customers.find((c) => norm(c.name) === n || c.aliases.some((a) => norm(a) === n));
  if (exact) return exact;
  let best: CustomerCtx | null = null;
  let score = 0;
  for (const c of customers) {
    for (const candidate of [c.name, ...c.aliases]) {
      const s = similarity(n, norm(candidate));
      if (s > score) {
        score = s;
        best = c;
      }
    }
  }
  return score >= 0.6 ? best : null;
}

/**
  Turns a reading into a draft order. The AI only supplied the reading; every decision
  here is plain code, and each doubtful one becomes a flag with its reason.
*/
export function processReading(reading: Reading, layer: TextLayer, ctx: Ctx): Draft {
  const flags: DraftFlag[] = [];
  const add = (code: FlagCode, severity: Severity, message: string, lineNo: number | null = null, data: Record<string, unknown> = {}) =>
    flags.push({ code, severity, message, lineNo, data });
  const productName = (id: string | null) => ctx.catalog.find((p) => p.id === id)?.name ?? "this product";
  const packOf = (id: string | null) => ctx.catalog.find((p) => p.id === id)?.pack ?? 1;

  // Café
  const customer = matchCustomer(reading.customer_name, ctx.customers);
  const cid = customer?.id ?? null;
  if (!customer) {
    add("customer_unrecognized", "blocker", `"${reading.customer_name || "No name"}" doesn't match any café on file. Choose one.`);
  }

  // Delivery date
  const today = toDateStr(ctx.now);
  const parsed = parseDelivery(reading.delivery_text, ctx.receivedAt);
  let deliveryDate = parsed.date;
  let deliveryReason = parsed.how;
  if (!deliveryDate && customer) {
    deliveryDate = nextServed(customer.days, ctx.receivedAt, ctx.cutoffHour);
    if (deliveryDate) {
      deliveryReason = `No date given → their next delivery day, ${fmtDay(deliveryDate)}`;
      add("date_defaulted", "check", `The order has no delivery date. Set to their next delivery day, ${fmtDay(deliveryDate)}.`);
    }
  } else if (deliveryDate && customer) {
    if (deliveryDate < today) {
      add("date_past", "check", `${fmtDay(deliveryDate)} has already passed.`, null, {
        suggest: nextServed(customer.days, ctx.now, ctx.cutoffHour),
      });
    } else {
      if (!customer.days.includes(weekday(deliveryDate))) {
        add("day_not_served", "check", `${customer.name} gets deliveries on ${daysList(customer.days)}. ${weekdayName(deliveryDate)} isn't one of them.`, null, {
          suggest: nextServedAfter(customer.days, deliveryDate),
        });
      }
      if (ctx.receivedAt.getTime() >= cutoffFor(deliveryDate, ctx.cutoffHour).getTime()) {
        add("after_cutoff", "check", `It arrived at ${fmtTime(ctx.receivedAt)}, after the 8:00 pm cutoff for ${fmtDay(deliveryDate)}.`, null, {
          suggest: nextServed(customer.days, ctx.receivedAt, ctx.cutoffHour),
        });
      }
    }
  }

  // "Same as last week"
  let lines: DraftLine[] = [];
  if (reading.repeat_previous) {
    const repeatRef = locate(layer, reading.repeat_quote);
    const prev = customer && deliveryDate ? ctx.lastWeek(customer.id, deliveryDate) : null;
    if (!prev) {
      add("repeat_resolved", "blocker", "They asked for the same as last week, but there's no earlier order to copy. Reject this one or ask the café.", null, { ref: repeatRef });
    } else {
      lines = prev.lines.map((l) => ({
        lineNo: 0,
        rawText: `Copied from ${fmtDay(prev.date)}`,
        productText: productName(l.productId),
        productId: l.productId,
        qty: l.qty,
        unitRaw: "",
        qtyEach: l.qty,
        method: "repeat" as MatchMethod,
        score: null,
        source: { kind: "none" } as SourceRef,
      }));
      const changes: string[] = [];
      for (const adj of reading.adjustments) {
        const m = matchProduct(adj.product_text, cid, ctx.catalog);
        const ref = locate(layer, adj.source_quote);
        const existing = m.productId ? lines.find((l) => l.productId === m.productId) : undefined;
        if (!m.productId) {
          lines.push({ lineNo: 0, rawText: adj.source_quote || adj.product_text, productText: adj.product_text, productId: null, qty: adj.quantity, unitRaw: "", qtyEach: adj.quantity, method: "none", score: m.score, source: ref });
          changes.push(`asked to ${adj.op} "${adj.product_text}"`);
          continue;
        }
        if (adj.op === "remove") {
          if (existing) lines = lines.filter((l) => l !== existing);
          changes.push(`removed ${productName(m.productId)}`);
        } else if (adj.op === "add") {
          const q = adj.quantity ?? 0;
          if (existing) {
            existing.qtyEach = (existing.qtyEach ?? 0) + q;
            existing.qty = existing.qtyEach;
            existing.rawText = adj.source_quote;
            existing.source = ref;
          } else {
            lines.push({ lineNo: 0, rawText: adj.source_quote, productText: adj.product_text, productId: m.productId, qty: q, unitRaw: "", qtyEach: q, method: m.method, score: m.score, source: ref });
          }
          changes.push(`added ${q} ${productName(m.productId)}`);
        } else if (adj.quantity != null) {
          if (existing) {
            existing.qtyEach = adj.quantity;
            existing.qty = adj.quantity;
            existing.rawText = adj.source_quote;
            existing.source = ref;
          }
          changes.push(`changed ${productName(m.productId)} to ${adj.quantity}`);
        }
      }
      add(
        "repeat_resolved",
        "info",
        `Copied ${prev.lines.length} lines from ${prev.label} for ${fmtDay(prev.date)}${changes.length ? `, then ${changes.join(" and ")}` : ""}.`,
        null,
        { fromOrderId: prev.orderId, ref: repeatRef },
      );
    }
  }

  // Written lines
  const unitNotes: { index: number; kind: "converted" | "unknown"; qty: number | null; unit: string; each: number | null }[] = [];
  for (const rl of reading.lines) {
    const m = matchProduct(rl.product_text, cid, ctx.catalog);
    const qty = rl.quantity_legible && rl.quantity != null ? rl.quantity : null;
    const conversion = convert(rl.unit_text, packOf(m.productId));
    const each = qty == null ? null : Math.round(qty * conversion.factor);
    lines.push({
      lineNo: 0,
      rawText: rl.raw_text,
      productText: rl.product_text,
      productId: m.productId,
      qty,
      unitRaw: rl.unit_text,
      qtyEach: each,
      method: m.productId ? m.method : "none",
      score: m.score,
      source: locate(layer, rl.source_quote),
    });
    if (conversion.kind !== "none") unitNotes.push({ index: lines.length - 1, kind: conversion.kind, qty, unit: rl.unit_text, each });
  }
  lines.forEach((l, i) => {
    l.lineNo = i + 1;
  });

  for (const u of unitNotes) {
    const line = lines[u.index];
    if (u.kind === "converted" && u.qty != null) add("unit_converted", "info", `${u.qty} ${u.unit} = ${u.each}`, line.lineNo);
    else if (u.kind === "unknown") add("ambiguous_unit", "check", `"${u.unit}" isn't a unit Docket knows, so this was read as ${u.qty ?? "?"} each.`, line.lineNo);
  }

  // Line checks
  for (const l of lines) {
    const label = l.productId ? productName(l.productId) : `"${l.productText}"`;
    if (!l.productId) {
      add("unknown_product", "blocker", `"${l.productText || l.rawText}" isn't in the catalog. Map it to a product or remove the line.`, l.lineNo);
    } else if (l.method === "fuzzy") {
      add("fuzzy_match", "check", `"${l.productText}" was matched to ${productName(l.productId)} by similarity, score ${(l.score ?? 0).toFixed(2)}.`, l.lineNo, { score: l.score });
    }
    if (l.qtyEach == null) {
      add("qty_unreadable", "blocker", `The quantity for ${label} couldn't be read.`, l.lineNo, {
        usual: cid && l.productId ? ctx.usual(cid, l.productId) : null,
      });
    } else if (cid && l.productId && l.method !== "repeat") {
      const usual = ctx.usual(cid, l.productId);
      if (usual && l.qtyEach > usual * 3 && l.qtyEach - usual >= 10) {
        add("unusual_qty", "check", `${l.qtyEach} is ${Math.round(l.qtyEach / usual)}× their usual ${usual}.`, l.lineNo, { usual });
      }
    }
  }

  // Resends
  const signature = signatureOf(lines);
  let duplicateOf: string | null = null;
  if (cid && deliveryDate && signature) {
    const dup = ctx.existing.find((e) => e.customerId === cid && e.date === deliveryDate && e.signature === signature);
    if (dup) {
      duplicateOf = dup.orderId;
      add("duplicate", "check", `Same café, same day and the same items as ${dup.label}. It may be a resend.`, null, { orderId: dup.orderId });
    }
  }

  return {
    customerId: cid,
    customerRaw: reading.customer_name,
    customerRef: locate(layer, reading.customer_quote),
    deliveryDate,
    deliveryReason,
    deliveryRef: locate(layer, reading.delivery_quote),
    poNumber: reading.po_number,
    notes: reading.notes,
    lines,
    flags,
    duplicateOf,
    signature,
  };
}
