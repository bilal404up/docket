import { BAKERY, CUSTOMERS, PRODUCTS } from "@/lib/seed/catalog";
import { addDays } from "./dates";
import type { CatalogProduct } from "./match";
import type { Ctx } from "./process";

/**
  The catalog and history without a database: product ids are SKUs, café ids are keys,
  and "usual" is the standing order. Used by the landing page and the tests.
*/
export function staticCatalog(): CatalogProduct[] {
  return PRODUCTS.map((p) => ({
    id: p.sku,
    sku: p.sku,
    name: p.name,
    pack: p.pack,
    dough: p.dough,
    aliases: p.aliases.map((alias) => ({ alias, customerId: null, source: "seed" as const })),
  }));
}

export function staticCtx(now: Date): Ctx {
  return {
    receivedAt: now,
    now,
    cutoffHour: BAKERY.cutoffHour,
    customers: CUSTOMERS.map((c) => ({ id: c.key, name: c.name, short: c.short, aliases: c.aliases, days: c.days })),
    catalog: staticCatalog(),
    usual: (customerId, productId) => CUSTOMERS.find((c) => c.key === customerId)?.standing[productId] ?? null,
    lastWeek: (customerId, date) => {
      const c = CUSTOMERS.find((x) => x.key === customerId);
      if (!c) return null;
      const d = addDays(date, -7);
      return {
        orderId: `history-${customerId}-${d}`,
        label: "last week's order",
        date: d,
        lines: Object.entries(c.standing).map(([productId, qty]) => ({ productId, qty })),
      };
    },
    existing: [],
  };
}
