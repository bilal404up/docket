import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewDate, type ClockWorkspace } from "@/lib/clock";
import { one } from "@/lib/db";
import { must } from "@/lib/errors";
import { addDays, weekday } from "@/lib/pipeline/dates";
import { DOUGH_ORDER } from "@/lib/seed/catalog";

export type BakeCafe = { orderId: string; customer: string; short: string; qty: number; lineNo: number; approved: boolean };
export type BakeRow = { productId: string; sku: string; name: string; approved: number; pending: number; cafes: BakeCafe[] };
export type BakeSection = { dough: string; rows: BakeRow[]; approved: number; doughKg: number };
export type BakeSheet = {
  date: string;
  sections: BakeSection[];
  approvedItems: number;
  approvedCafes: number;
  pendingOrders: number;
  pendingItems: number;
};

export async function loadBakeSheet(sb: SupabaseClient, wsId: string, date: string): Promise<BakeSheet> {
  const [productsRes, ordersRes] = await Promise.all([
    must(sb.from("products").select("id,sku,name,dough,dough_g").eq("workspace_id", wsId)),
    must(
      sb
        .from("orders")
        .select("id,status,customers(name,short),order_lines(line_no,product_id,qty_each,removed)")
        .eq("workspace_id", wsId)
        .eq("delivery_date", date)
        .in("status", ["approved", "draft"]),
    ),
  ]);
  const products = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
  const rows = new Map<string, BakeRow>();
  const approvedCafes = new Set<string>();
  let pendingOrders = 0;

  for (const o of (ordersRes.data ?? []) as any[]) {
    const cust = one<any>(o.customers);
    const approved = o.status === "approved";
    if (!approved) pendingOrders++;
    for (const l of o.order_lines ?? []) {
      if (l.removed || !l.product_id || l.qty_each == null) continue;
      const p = products.get(l.product_id);
      if (!p) continue;
      let row = rows.get(p.id);
      if (!row) {
        row = { productId: p.id, sku: p.sku, name: p.name, approved: 0, pending: 0, cafes: [] };
        rows.set(p.id, row);
      }
      const qty = Number(l.qty_each);
      if (approved) {
        row.approved += qty;
        approvedCafes.add(cust?.name ?? o.id);
      } else {
        row.pending += qty;
      }
      row.cafes.push({ orderId: o.id, customer: cust?.name ?? "Unknown café", short: cust?.short ?? "?", qty, lineNo: l.line_no, approved });
    }
  }

  const all = Array.from(rows.values());
  all.forEach((r) => r.cafes.sort((a, b) => Number(b.approved) - Number(a.approved) || a.customer.localeCompare(b.customer)));
  const doughs = [...DOUGH_ORDER, ...Array.from(new Set(all.map((r) => products.get(r.productId).dough))).filter((d) => !DOUGH_ORDER.includes(d))];
  const sections: BakeSection[] = doughs
    .map((dough) => {
      const sectionRows = all.filter((r) => products.get(r.productId).dough === dough).sort((a, b) => a.name.localeCompare(b.name));
      const grams = sectionRows.reduce((g, r) => g + r.approved * (products.get(r.productId).dough_g ?? 0), 0);
      return {
        dough,
        rows: sectionRows,
        approved: sectionRows.reduce((n, r) => n + r.approved, 0),
        doughKg: Math.round(grams / 100) / 10,
      };
    })
    .filter((s) => s.rows.length);

  return {
    date,
    sections,
    approvedItems: all.reduce((n, r) => n + r.approved, 0),
    approvedCafes: approvedCafes.size,
    pendingOrders,
    pendingItems: all.reduce((n, r) => n + r.pending, 0),
  };
}

/** Seven days from the delivery day under review. The bakery doesn't deliver on Sundays. */
export function bakeDays(ws: ClockWorkspace): { date: string; served: boolean }[] {
  const start = reviewDate(ws);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, served: weekday(date) !== 0 };
  });
}
