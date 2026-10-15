import type { SupabaseClient } from "@supabase/supabase-js";
import { latestWednesday, storyAt } from "@/lib/clock";
import { must } from "@/lib/errors";
import { logEvent } from "@/lib/events";
import { addDays, weekday } from "@/lib/pipeline/dates";
import { ingest } from "@/lib/pipeline/run";
import { SAMPLES } from "@/lib/samples";
import { requireWorkspace, type Workspace } from "@/lib/workspace";
import { CUSTOMERS, PRODUCTS } from "./catalog";

/* Small, repeatable variation so history looks like real ordering, not a copy-paste. */
function wobble(key: string, base: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const span = base >= 6 ? 2 : 1;
  return Math.max(1, base + ((h >>> 0) % (span * 2 + 1)) - span);
}

/** Creates a fresh sandbox for the signed-in visitor, replacing any old one, and fills it. */
export async function createSandbox(sb: SupabaseClient): Promise<Workspace> {
  const { error } = await sb.rpc("create_workspace", { p_story_date: latestWednesday() });
  if (error) throw new Error(error.message);
  const ws = await requireWorkspace(sb);
  await seedWorkspace(sb, ws);
  return ws;
}

export async function seedWorkspace(sb: SupabaseClient, ws: Workspace) {
  const products = PRODUCTS.map((p) => ({
    id: crypto.randomUUID(),
    workspace_id: ws.id,
    sku: p.sku,
    name: p.name,
    pack: p.pack,
    dough: p.dough,
    dough_g: p.doughG,
  }));
  const bySku = new Map(products.map((p) => [p.sku, p.id]));
  const customers = CUSTOMERS.map((c) => ({
    id: crypto.randomUUID(),
    workspace_id: ws.id,
    key: c.key,
    name: c.name,
    short: c.short,
    aliases: c.aliases,
    delivery_days: c.days,
  }));
  await must(sb.from("products").insert(products));
  await must(sb.from("customers").insert(customers));

  const aliases = PRODUCTS.flatMap((p) =>
    p.aliases.map((alias) => ({ workspace_id: ws.id, product_id: bySku.get(p.sku), alias, source: "seed" })),
  );
  if (aliases.length) await must(sb.from("product_aliases").insert(aliases));

  // Three weeks of approved standing orders, up to and including the story day.
  const orders: Record<string, unknown>[] = [];
  const lines: Record<string, unknown>[] = [];
  for (const c of CUSTOMERS) {
    const customerId = customers.find((x) => x.key === c.key)!.id;
    for (let i = 21; i >= 0; i--) {
      const date = addDays(ws.story_date, -i);
      if (!c.days.includes(weekday(date))) continue;
      const orderId = crypto.randomUUID();
      orders.push({
        id: orderId,
        workspace_id: ws.id,
        customer_id: customerId,
        customer_raw: c.name,
        delivery_date: date,
        delivery_reason: "Standing order",
        status: "approved",
        is_history: true,
        approved_at: storyAt(date, "19:30", -1).toISOString(),
      });
      let n = 0;
      for (const [sku, qty] of Object.entries(c.standing)) {
        n++;
        const q = c.steady?.includes(sku) ? qty : wobble(`${c.key}|${date}|${sku}`, qty);
        lines.push({
          workspace_id: ws.id,
          order_id: orderId,
          line_no: n,
          raw_text: "Standing order",
          product_text: sku,
          product_id: bySku.get(sku),
          qty: q,
          qty_each: q,
          match_method: "exact",
          match_score: 1,
        });
      }
    }
  }
  for (let i = 0; i < orders.length; i += 200) await must(sb.from("orders").insert(orders.slice(i, i + 200)));
  for (let i = 0; i < lines.length; i += 500) await must(sb.from("order_lines").insert(lines.slice(i, i + 500)));

  // The evening's documents, read in the order they arrived so the resend is caught.
  const inbox = SAMPLES.filter((s) => s.inInbox).sort((a, b) => a.received.localeCompare(b.received));
  for (const s of inbox) await ingest(sb, ws, { kind: "sample", sampleKey: s.key }, "seed");

  await logEvent(
    sb,
    ws.id,
    "sandbox.created",
    `Sandbox opened with ${CUSTOMERS.length} cafés, ${PRODUCTS.length} products and three weeks of order history`,
  );
}
