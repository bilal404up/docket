import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { loadBakeSheet } from "@/lib/data/bake-sheet";
import { isDateStr } from "@/lib/pipeline/dates";
import { createClient } from "@/lib/supabase/server";
import { fetchWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!isDateStr(date)) return new NextResponse("Add ?date=YYYY-MM-DD", { status: 400 });
  const sb = createClient();
  const ws = await fetchWorkspace(sb);
  if (!ws) return new NextResponse("Your sandbox has expired", { status: 401 });
  const sheet = await loadBakeSheet(sb, ws.id, date);
  const rows: (string | number)[][] = [["delivery_date", "dough", "sku", "product", "approved", "pending"]];
  for (const s of sheet.sections) for (const r of s.rows) rows.push([date, s.dough, r.sku, r.name, r.approved, r.pending]);
  return new NextResponse(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bake-sheet-${date}.csv"` },
  });
}
