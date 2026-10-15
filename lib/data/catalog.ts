import type { SupabaseClient } from "@supabase/supabase-js";
import { must } from "@/lib/errors";

export type CatalogProductRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  pack: number;
  dough: string;
  active: boolean;
  aliases: { alias: string; source: "seed" | "learned"; customer: string | null }[];
};
export type CatalogCustomerRow = { id: string; name: string; short: string; aliases: string[]; days: number[]; lastOrder: string | null };

export async function loadCatalogPage(sb: SupabaseClient, wsId: string) {
  const [products, aliases, customers, orders] = await Promise.all([
    must(sb.from("products").select("id,sku,name,unit,pack,dough,active").eq("workspace_id", wsId).order("sku")),
    must(sb.from("product_aliases").select("product_id,alias,source,customer_id,created_at").eq("workspace_id", wsId).order("created_at")),
    must(sb.from("customers").select("id,name,short,aliases,delivery_days").eq("workspace_id", wsId).order("name")),
    must(sb.from("orders").select("customer_id,delivery_date").eq("workspace_id", wsId).eq("status", "approved")),
  ]);
  const custName = new Map<string, string>((customers.data ?? []).map((c: any) => [c.id, c.name]));
  const last = new Map<string, string>();
  for (const o of (orders.data ?? []) as any[]) {
    if (!o.customer_id || !o.delivery_date) continue;
    const prev = last.get(o.customer_id);
    if (!prev || o.delivery_date > prev) last.set(o.customer_id, o.delivery_date);
  }
  const productRows: CatalogProductRow[] = (products.data ?? []).map((p: any) => ({
    ...p,
    aliases: (aliases.data ?? [])
      .filter((a: any) => a.product_id === p.id)
      .map((a: any) => ({ alias: a.alias, source: a.source, customer: a.customer_id ? custName.get(a.customer_id) ?? null : null })),
  }));
  const customerRows: CatalogCustomerRow[] = (customers.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    short: c.short,
    aliases: c.aliases ?? [],
    days: c.delivery_days ?? [],
    lastOrder: last.get(c.id) ?? null,
  }));
  return { products: productRows, customers: customerRows };
}
