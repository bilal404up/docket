import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { one } from "@/lib/db";
import { isDateStr } from "@/lib/pipeline/dates";
import { createClient } from "@/lib/supabase/server";
import { fetchWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

/** Approved orders for one delivery day, one row per line. */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!isDateStr(date)) return new NextResponse("Add ?date=YYYY-MM-DD", { status: 400 });
  const sb = createClient();
  const ws = await fetchWorkspace(sb);
  if (!ws) return new NextResponse("Your sandbox has expired", { status: 401 });
  const { data } = await sb
    .from("orders")
    .select("id,po_number,customers(name),order_lines(line_no,qty_each,removed,products(sku,name))")
    .eq("workspace_id", ws.id)
    .eq("delivery_date", date)
    .eq("status", "approved");
  const rows: (string | number | null)[][] = [["order_id", "cafe", "po_number", "delivery_date", "line", "sku", "product", "qty"]];
  for (const o of (data ?? []) as any[]) {
    const lines = [...(o.order_lines ?? [])].sort((a: any, b: any) => a.line_no - b.line_no);
    for (const l of lines) {
      if (l.removed) continue;
      const p = one<any>(l.products);
      rows.push([o.id, one<any>(o.customers)?.name ?? "", o.po_number, date, l.line_no, p?.sku ?? "", p?.name ?? "", l.qty_each]);
    }
  }
  return new NextResponse(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${date}.csv"` },
  });
}
