import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/db";
import { must } from "@/lib/errors";
import { openCounts } from "@/lib/flags";
import type { DocStatus, SourceKind } from "@/lib/types";

export type InboxRow = {
  documentId: string;
  orderId: string | null;
  source: SourceKind;
  title: string;
  sender: string | null;
  customer: string | null;
  receivedAt: string;
  status: DocStatus;
  lines: number;
  blockers: number;
  checks: number;
  error: string | null;
  deliveryDate: string | null;
};

export async function loadInbox(sb: SupabaseClient, wsId: string): Promise<InboxRow[]> {
  const { data } = await must(
    sb
      .from("documents")
      .select("id,source,title,sender,status,error,received_at,orders(id,delivery_date,customer_raw,customers(name),order_lines(removed),flags(severity,resolved_at))")
      .eq("workspace_id", wsId)
      .order("received_at", { ascending: false }),
  );
  return (data ?? []).map((d: any) => {
    const o = one<any>(d.orders);
    const { blockers, checks } = openCounts(o?.flags ?? []);
    return {
      documentId: d.id,
      orderId: o?.id ?? null,
      source: d.source,
      title: d.title,
      sender: d.sender,
      customer: one<any>(o?.customers)?.name ?? o?.customer_raw ?? null,
      receivedAt: d.received_at,
      status: d.status,
      lines: (o?.order_lines ?? []).filter((l: any) => !l.removed).length,
      blockers,
      checks,
      error: d.error,
      deliveryDate: o?.delivery_date ?? null,
    };
  });
}

export type InboxFilter = "check" | "ready" | "approved" | "rejected" | "all";

export function filterRows(rows: InboxRow[], f: InboxFilter): InboxRow[] {
  if (f === "check") return rows.filter((r) => r.status === "needs_check" || r.status === "failed");
  if (f === "ready") return rows.filter((r) => r.status === "ready");
  if (f === "approved") return rows.filter((r) => r.status === "approved");
  if (f === "rejected") return rows.filter((r) => r.status === "rejected");
  return rows;
}

export function inboxCounts(rows: InboxRow[]) {
  return {
    check: filterRows(rows, "check").length,
    ready: filterRows(rows, "ready").length,
    approved: filterRows(rows, "approved").length,
    rejected: filterRows(rows, "rejected").length,
    all: rows.length,
  };
}
