import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/db";
import { must } from "@/lib/errors";
import { BAKERY } from "@/lib/seed/catalog";
import { addDays, fmtTime } from "./dates";
import type { CatalogProduct } from "./match";
import { signatureOf, type Ctx, type CustomerCtx } from "./process";

type OrderRow = {
  id: string;
  status: string;
  customer_id: string | null;
  delivery_date: string | null;
  is_history: boolean;
  documents: { received_at: string } | { received_at: string }[] | null;
  order_lines: { product_id: string | null; qty_each: number | null; removed: boolean }[];
};

export async function loadCatalog(sb: SupabaseClient, wsId: string): Promise<CatalogProduct[]> {
  const [products, aliases] = await Promise.all([
    must(sb.from("products").select("id,sku,name,pack,dough,active").eq("workspace_id", wsId).order("sku")),
    must(sb.from("product_aliases").select("id,product_id,alias,customer_id,source").eq("workspace_id", wsId)),
  ]);
  return (products.data ?? [])
    .filter((p: any) => p.active)
    .map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      pack: p.pack,
      dough: p.dough,
      aliases: (aliases.data ?? [])
        .filter((a: any) => a.product_id === p.id)
        .map((a: any) => ({ id: a.id, alias: a.alias, customerId: a.customer_id, source: a.source })),
    }));
}

export async function loadCustomers(sb: SupabaseClient, wsId: string): Promise<CustomerCtx[]> {
  const { data } = await must(sb.from("customers").select("id,name,short,aliases,delivery_days").eq("workspace_id", wsId));
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name, short: c.short, aliases: c.aliases ?? [], days: c.delivery_days ?? [] }));
}

/** Everything the decision engine needs about this sandbox: catalog, cafés, history and today's orders. */
export async function buildCtx(sb: SupabaseClient, wsId: string, receivedAt: Date, now: Date): Promise<Ctx> {
  const [customers, catalog, ordersRes] = await Promise.all([
    loadCustomers(sb, wsId),
    loadCatalog(sb, wsId),
    must(
      sb
        .from("orders")
        .select("id,status,customer_id,delivery_date,is_history,documents(received_at),order_lines(product_id,qty_each,removed)")
        .eq("workspace_id", wsId)
        .neq("status", "rejected"),
    ),
  ]);
  const orders = (ordersRes.data ?? []) as OrderRow[];
  const liveLines = (o: OrderRow) =>
    o.order_lines
      .filter((l) => !l.removed && l.product_id && l.qty_each != null)
      .map((l) => ({ productId: l.product_id as string, qty: Number(l.qty_each) }));
  const approved = orders
    .filter((o) => o.status === "approved" && o.customer_id && o.delivery_date)
    .sort((a, b) => (b.delivery_date as string).localeCompare(a.delivery_date as string));

  return {
    receivedAt,
    now,
    cutoffHour: BAKERY.cutoffHour,
    customers,
    catalog,
    usual(customerId, productId) {
      const qtys: number[] = [];
      for (const o of approved) {
        if (o.customer_id !== customerId) continue;
        const line = liveLines(o).find((l) => l.productId === productId);
        if (line) qtys.push(line.qty);
        if (qtys.length === 4) break;
      }
      if (!qtys.length) return null;
      const s = [...qtys].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    },
    lastWeek(customerId, date) {
      const target = addDays(date, -7);
      const mine = approved.filter((o) => o.customer_id === customerId && (o.delivery_date as string) < date);
      const exact = mine.find((o) => o.delivery_date === target);
      const pick = exact ?? mine[0];
      if (!pick) return null;
      return {
        orderId: pick.id,
        label: exact ? "last week's order" : "their last order",
        date: pick.delivery_date as string,
        lines: liveLines(pick),
      };
    },
    existing: orders
      .filter((o) => !o.is_history && o.customer_id && o.delivery_date)
      .map((o) => {
        const doc = one(o.documents);
        return {
          orderId: o.id,
          customerId: o.customer_id as string,
          date: o.delivery_date as string,
          signature: signatureOf(liveLines(o).map((l) => ({ productId: l.productId, qtyEach: l.qty }))),
          label: doc ? `the order that arrived at ${fmtTime(new Date(doc.received_at))}` : "an earlier order",
        };
      }),
  };
}
