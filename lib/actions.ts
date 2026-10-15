"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storyNow } from "@/lib/clock";
import { loadNextOrderId } from "@/lib/data/order";
import { UUID, errorMessage, one } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { logEvent } from "@/lib/events";
import { DATE_CODES, openCounts } from "@/lib/flags";
import { siteOrigin } from "@/lib/origin";
import { fmtDay, isDateStr, nextServed, toDateStr } from "@/lib/pipeline/dates";
import { normProduct } from "@/lib/pipeline/normalize";
import { createClient } from "@/lib/supabase/server";
import type { FlagCode } from "@/lib/types";
import { deliverWebhook } from "@/lib/webhook";
import { requireWorkspace, type Workspace } from "@/lib/workspace";

export type ActionResult<T extends object = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

type Draft = {
  sb: SupabaseClient;
  ws: Workspace;
  order: { id: string; document_id: string | null; customer_id: string | null; delivery_date: string | null };
  cafe: string;
};

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const value = await fn();
    return { ok: true as const, ...value };
  } catch (e) {
    if (!(e instanceof UserError)) console.error(e);
    return { ok: false as const, error: errorMessage(e) };
  }
}

const notFound = () => new UserError("not_found", "That order isn't in your sandbox.");

/** Opens a draft order for editing. Approved and rejected orders are locked. */
async function openDraft(orderId: string): Promise<Draft> {
  if (!UUID.test(orderId)) throw notFound();
  const sb = createClient();
  const ws = await requireWorkspace(sb);
  const { data: order } = await sb
    .from("orders")
    .select("id,status,document_id,customer_id,delivery_date,customer_raw,customers(name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw notFound();
  if (order.status !== "draft") throw new UserError("locked", `This order is already ${order.status}.`);
  return { sb, ws, order, cafe: one<any>(order.customers)?.name ?? order.customer_raw ?? "Unknown café" };
}

/** After any change: refresh the document's status from the flags still open. */
async function finish(d: Draft) {
  const { data: flags } = await d.sb.from("flags").select("severity,resolved_at").eq("order_id", d.order.id);
  const { blockers, checks } = openCounts(flags ?? []);
  if (d.order.document_id) {
    await d.sb.from("documents").update({ status: blockers + checks ? "needs_check" : "ready" }).eq("id", d.order.document_id);
  }
  revalidatePath("/app", "layout");
}

async function resolveFlags(d: Draft, codes: FlagCode[] | "all", lineNo: number | null | undefined, resolution: string) {
  let q = d.sb
    .from("flags")
    .update({ resolved_at: new Date().toISOString(), resolution })
    .eq("order_id", d.order.id)
    .is("resolved_at", null);
  if (codes !== "all") q = q.in("code", codes);
  if (lineNo === null) q = q.is("line_no", null);
  else if (lineNo !== undefined) q = q.eq("line_no", lineNo);
  await q;
}

async function getLine(d: Draft, lineNo: number) {
  if (!Number.isInteger(lineNo) || lineNo < 1) throw new UserError("bad_line", "That line doesn't exist.");
  const { data: line } = await d.sb
    .from("order_lines")
    .select("line_no,product_text,raw_text,product_id,qty_each,removed,products(name)")
    .eq("order_id", d.order.id)
    .eq("line_no", lineNo)
    .maybeSingle();
  if (!line) throw new UserError("bad_line", "That line doesn't exist.");
  return { ...line, productName: one<any>(line.products)?.name as string | undefined };
}

async function recordEdit(d: Draft, lineNo: number | null, field: string, aiValue: unknown, newValue: unknown) {
  await d.sb.from("field_edits").insert({
    workspace_id: d.ws.id,
    order_id: d.order.id,
    line_no: lineNo,
    field,
    ai_value: aiValue == null ? null : String(aiValue),
    new_value: newValue == null ? null : String(newValue),
  });
}

/** Saves the way this café writes a product, so it matches without a flag next time. */
async function learnAlias(d: Draft, text: string, productId: string) {
  if (!d.order.customer_id || !text.trim()) return;
  const { data: existing } = await d.sb
    .from("product_aliases")
    .select("id,alias")
    .eq("workspace_id", d.ws.id)
    .eq("customer_id", d.order.customer_id);
  if ((existing ?? []).some((a: any) => normProduct(a.alias) === normProduct(text))) return;
  await d.sb.from("product_aliases").insert({
    workspace_id: d.ws.id,
    product_id: productId,
    alias: text.trim(),
    customer_id: d.order.customer_id,
    source: "learned",
  });
}

export async function setLineProduct(orderId: string, lineNo: number, productId: string, remember: boolean) {
  return run(async () => {
    const d = await openDraft(orderId);
    const line = await getLine(d, lineNo);
    if (!UUID.test(productId)) throw new UserError("bad_product", "Choose a product from the catalog.");
    const { data: product } = await d.sb.from("products").select("id,name").eq("id", productId).maybeSingle();
    if (!product) throw new UserError("bad_product", "Choose a product from the catalog.");
    const learn = remember && Boolean(d.order.customer_id) && Boolean(line.product_text);

    await d.sb
      .from("order_lines")
      .update({ product_id: product.id, match_method: learn ? "learned" : "manual", match_score: null })
      .eq("order_id", d.order.id)
      .eq("line_no", lineNo);
    await recordEdit(d, lineNo, "product", line.productName ?? `"${line.product_text}"`, product.name);
    if (learn) await learnAlias(d, line.product_text, product.id);
    await resolveFlags(d, ["unknown_product", "fuzzy_match"], lineNo, `Set to ${product.name}`);
    await logEvent(
      d.sb,
      d.ws.id,
      "line.product",
      `${d.cafe}, L${lineNo}: "${line.product_text}" set to ${product.name}${learn ? ", remembered for next time" : ""}`,
      { order_id: d.order.id },
    );
    await finish(d);
    return {};
  });
}

export async function confirmMatch(orderId: string, lineNo: number, remember: boolean) {
  return run(async () => {
    const d = await openDraft(orderId);
    const line = await getLine(d, lineNo);
    if (!line.product_id) throw new UserError("no_product", "Choose a product for this line first.");
    if (remember && d.order.customer_id) {
      await learnAlias(d, line.product_text, line.product_id);
      await d.sb.from("order_lines").update({ match_method: "learned" }).eq("order_id", d.order.id).eq("line_no", lineNo);
    }
    await resolveFlags(d, ["fuzzy_match"], lineNo, remember ? "Confirmed and remembered" : "Confirmed");
    await logEvent(
      d.sb,
      d.ws.id,
      "line.confirmed",
      `${d.cafe}, L${lineNo}: confirmed "${line.product_text}" is ${line.productName}${remember ? ", remembered for next time" : ""}`,
      { order_id: d.order.id },
    );
    await finish(d);
    return {};
  });
}

export async function setLineQty(orderId: string, lineNo: number, qty: number) {
  return run(async () => {
    const d = await openDraft(orderId);
    const line = await getLine(d, lineNo);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10_000) throw new UserError("bad_qty", "Enter a whole number from 1 to 10,000.");
    await d.sb.from("order_lines").update({ qty, qty_each: qty }).eq("order_id", d.order.id).eq("line_no", lineNo);
    await recordEdit(d, lineNo, "quantity", line.qty_each ?? "unreadable", qty);
    await resolveFlags(d, ["qty_unreadable", "unusual_qty", "ambiguous_unit"], lineNo, `Set to ${qty}`);
    await logEvent(
      d.sb,
      d.ws.id,
      "line.qty",
      `${d.cafe}, L${lineNo}: quantity ${line.qty_each == null ? "unreadable" : line.qty_each} → ${qty}`,
      { order_id: d.order.id },
    );
    await finish(d);
    return {};
  });
}

export async function removeLine(orderId: string, lineNo: number) {
  return run(async () => {
    const d = await openDraft(orderId);
    const line = await getLine(d, lineNo);
    await d.sb.from("order_lines").update({ removed: true }).eq("order_id", d.order.id).eq("line_no", lineNo);
    await recordEdit(d, lineNo, "line", line.raw_text || line.product_text, "removed");
    await resolveFlags(d, "all", lineNo, "Line removed");
    await logEvent(d.sb, d.ws.id, "line.removed", `${d.cafe}, L${lineNo}: removed "${line.product_text || line.raw_text}"`, { order_id: d.order.id });
    await finish(d);
    return {};
  });
}

export async function setCustomer(orderId: string, customerId: string) {
  return run(async () => {
    const d = await openDraft(orderId);
    if (!UUID.test(customerId)) throw new UserError("bad_customer", "Choose a café.");
    const { data: c } = await d.sb.from("customers").select("id,name,delivery_days").eq("id", customerId).maybeSingle();
    if (!c) throw new UserError("bad_customer", "Choose a café.");
    const update: Record<string, unknown> = { customer_id: c.id };
    if (!d.order.delivery_date) {
      const date = nextServed(c.delivery_days, storyNow(d.ws));
      if (date) {
        update.delivery_date = date;
        update.delivery_reason = `No date given → their next delivery day, ${fmtDay(date)}`;
      }
    }
    await d.sb.from("orders").update(update).eq("id", d.order.id);
    await recordEdit(d, null, "café", null, c.name);
    await resolveFlags(d, ["customer_unrecognized"], null, `Set to ${c.name}`);
    await logEvent(d.sb, d.ws.id, "order.customer", `Order set to ${c.name}`, { order_id: d.order.id });
    await finish(d);
    return {};
  });
}

export async function setDeliveryDate(orderId: string, date: string) {
  return run(async () => {
    const d = await openDraft(orderId);
    if (!isDateStr(date)) throw new UserError("bad_date", "Pick a date.");
    if (date < toDateStr(storyNow(d.ws))) throw new UserError("bad_date", "Pick today or a later day.");
    await d.sb.from("orders").update({ delivery_date: date, delivery_reason: `Changed by you to ${fmtDay(date)}` }).eq("id", d.order.id);
    await recordEdit(d, null, "delivery date", d.order.delivery_date, date);
    await resolveFlags(d, DATE_CODES, null, `Moved to ${fmtDay(date)}`);
    await logEvent(d.sb, d.ws.id, "order.date", `${d.cafe}: delivery moved to ${fmtDay(date)}`, { order_id: d.order.id });
    await finish(d);
    return {};
  });
}

const ACCEPT_TEXT: Partial<Record<FlagCode, string>> = {
  date_defaulted: "Date confirmed",
  date_past: "Kept the date",
  after_cutoff: "Accepted after the cutoff",
  day_not_served: "Kept the day they asked for",
  duplicate: "Kept both orders",
  unusual_qty: "Kept the quantity as read",
  ambiguous_unit: "Kept as read",
  fuzzy_match: "Confirmed",
};

/** Accepts a check as it stands. Blockers can't be accepted; they need a change. */
export async function acceptFlag(flagId: string) {
  return run(async () => {
    if (!UUID.test(flagId)) throw new UserError("not_found", "That item no longer exists.");
    const sb = createClient();
    const { data: flag } = await sb.from("flags").select("id,order_id,code,severity,line_no,resolved_at").eq("id", flagId).maybeSingle();
    if (!flag) throw new UserError("not_found", "That item no longer exists.");
    if (flag.severity === "blocker") throw new UserError("blocker", "This one needs a change before the order can go through.");
    const d = await openDraft(flag.order_id);
    if (!flag.resolved_at) {
      const text = ACCEPT_TEXT[flag.code as FlagCode] ?? "Accepted";
      await d.sb.from("flags").update({ resolved_at: new Date().toISOString(), resolution: text }).eq("id", flag.id);
      await logEvent(d.sb, d.ws.id, "flag.accepted", `${d.cafe}${flag.line_no ? `, L${flag.line_no}` : ""}: ${text.toLowerCase()}`, { order_id: d.order.id });
    }
    await finish(d);
    return {};
  });
}

export async function rejectOrder(orderId: string, reason = "Rejected") {
  return run(async () => {
    const d = await openDraft(orderId);
    const why = reason.slice(0, 120);
    await d.sb.from("orders").update({ status: "rejected" }).eq("id", d.order.id);
    if (d.order.document_id) await d.sb.from("documents").update({ status: "rejected" }).eq("id", d.order.document_id);
    await resolveFlags(d, "all", undefined, why);
    await logEvent(d.sb, d.ws.id, "order.rejected", `${d.cafe}: ${why.toLowerCase()}`, { order_id: d.order.id });
    revalidatePath("/app", "layout");
    return { next: await loadNextOrderId(d.sb, d.ws.id, d.order.id) };
  });
}

export async function approveOrder(orderId: string) {
  return run(async () => {
    const d = await openDraft(orderId);
    const { data: lines } = await d.sb
      .from("order_lines")
      .select("line_no,qty_each,removed,products(sku,name)")
      .eq("order_id", d.order.id)
      .order("line_no");
    const live = (lines ?? []).filter((l: any) => !l.removed && l.qty_each != null);
    if (!live.length) throw new UserError("empty", "There are no lines left to approve. Reject the order instead.");
    if (!d.order.customer_id) throw new UserError("no_customer", "Choose the café first.");
    if (!d.order.delivery_date) throw new UserError("no_date", "Set a delivery date first.");
    const items = live.reduce((n: number, l: any) => n + Number(l.qty_each), 0);
    const date = d.order.delivery_date;

    const { error } = await d.sb.rpc("approve_order", {
      p_order: d.order.id,
      p_summary: `Approved ${d.cafe} for ${fmtDay(date)}: ${items} items`,
    });
    if (error) throw new UserError("approve", error.message);

    try {
      await deliverWebhook(d.sb, d.ws, siteOrigin(), "order.approved", {
        order_id: d.order.id,
        cafe: d.cafe,
        delivery_date: date,
        items,
        lines: live.map((l: any) => ({ line: l.line_no, sku: one<any>(l.products)?.sku, product: one<any>(l.products)?.name, qty: Number(l.qty_each) })),
      });
    } catch (e) {
      console.error("Webhook delivery failed", e);
    }
    revalidatePath("/app", "layout");
    return { next: await loadNextOrderId(d.sb, d.ws.id, d.order.id), date, items };
  });
}

export async function sendTestWebhook() {
  return run(async () => {
    const sb = createClient();
    const ws = await requireWorkspace(sb);
    const status = await deliverWebhook(sb, ws, siteOrigin(), "test.ping", { message: "Test event from Docket" });
    revalidatePath("/app/activity");
    revalidatePath("/app/settings");
    return { status };
  });
}

/** Deletes a document that failed to read, with its stored file. */
export async function deleteDocument(documentId: string) {
  return run(async () => {
    if (!UUID.test(documentId)) throw new UserError("not_found", "That document isn't in your sandbox.");
    const sb = createClient();
    const ws = await requireWorkspace(sb);
    const { data: doc } = await sb.from("documents").select("id,status,title,file_path").eq("id", documentId).maybeSingle();
    if (!doc) throw new UserError("not_found", "That document isn't in your sandbox.");
    if (doc.status !== "failed") throw new UserError("not_failed", "Only documents that failed to read can be deleted.");
    if (doc.file_path) await sb.storage.from("uploads").remove([doc.file_path]);
    await sb.from("documents").delete().eq("id", doc.id);
    await logEvent(sb, ws.id, "document.deleted", `Deleted ${doc.title}`, {});
    revalidatePath("/app", "layout");
    return {};
  });
}
