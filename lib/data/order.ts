import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID, one } from "@/lib/db";
import { must } from "@/lib/errors";
import { sampleByKey } from "@/lib/samples";
import type {
  DocStatus, FlagCode, MatchMethod, OrderStatus, ReadingMeta, Severity, SourceKind, SourceRef, TextLayer,
} from "@/lib/types";
import type { Workspace } from "@/lib/workspace";

export type LineView = {
  lineNo: number;
  rawText: string;
  productText: string;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  qty: number | null;
  qtyEach: number | null;
  unitRaw: string;
  method: MatchMethod;
  score: number | null;
  source: SourceRef;
  removed: boolean;
};

export type FlagView = {
  id: string;
  code: FlagCode;
  severity: Severity;
  message: string;
  lineNo: number | null;
  data: Record<string, any>;
  resolvedAt: string | null;
  resolution: string | null;
};

export type DocView = {
  id: string;
  source: SourceKind;
  title: string;
  sender: string | null;
  receivedAt: string;
  status: DocStatus;
  error: string | null;
  layer: TextLayer;
  body: string | null;
  imageUrl: string | null;
  originalUrl: string | null;
  sampleKey: string | null;
};

export type OrderView = {
  id: string;
  status: OrderStatus;
  customerId: string | null;
  customerRaw: string | null;
  customerRef: SourceRef;
  deliveryDate: string | null;
  deliveryReason: string | null;
  deliveryRef: SourceRef;
  poNumber: string | null;
  notes: string | null;
  duplicateOf: string | null;
  approvedAt: string | null;
  customer: { id: string; name: string; short: string; days: number[] } | null;
  lines: LineView[];
  flags: FlagView[];
  document: DocView | null;
  reading: ReadingMeta | null;
  products: { id: string; name: string; sku: string }[];
  customers: { id: string; name: string }[];
};

const SEVERITY_ORDER: Record<Severity, number> = { blocker: 0, check: 1, info: 2 };

export async function loadOrder(sb: SupabaseClient, ws: Workspace, orderId: string): Promise<OrderView | null> {
  if (!UUID.test(orderId)) return null;
  const { data: o } = await sb
    .from("orders")
    .select("id,status,customer_id,customer_raw,customer_ref,delivery_date,delivery_reason,delivery_ref,po_number,notes,duplicate_of,approved_at,document_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;

  const [lines, flags, doc, reading, products, customers] = await Promise.all([
    must(
      sb
        .from("order_lines")
        .select("line_no,raw_text,product_text,product_id,qty,qty_each,unit_raw,match_method,match_score,source_ref,removed,products(name,sku)")
        .eq("order_id", o.id)
        .order("line_no"),
    ),
    must(sb.from("flags").select("id,code,severity,message,line_no,data,resolved_at,resolution").eq("order_id", o.id).order("created_at")),
    o.document_id
      ? must(
          sb
            .from("documents")
            .select("id,source,title,sender,received_at,status,error,text_layer,body_text,file_path,mime,sample_key")
            .eq("id", o.document_id)
            .maybeSingle(),
        )
      : Promise.resolve({ data: null }),
    o.document_id
      ? must(
          sb
            .from("readings")
            .select("mode,kind,model,captured")
            .eq("document_id", o.document_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        )
      : Promise.resolve({ data: null }),
    must(sb.from("products").select("id,name,sku").eq("workspace_id", ws.id).eq("active", true).order("name")),
    must(sb.from("customers").select("id,name,short,delivery_days").eq("workspace_id", ws.id).order("name")),
  ]);

  const d: any = doc.data;
  let imageUrl: string | null = null;
  let originalUrl: string | null = null;
  if (d) {
    const sample = d.sample_key ? sampleByKey(d.sample_key) : null;
    if (sample) {
      originalUrl = `/api/samples/${sample.key}`;
      if (sample.asset) imageUrl = sample.asset;
    } else if (d.file_path) {
      originalUrl = `/api/documents/${d.id}/file`;
      if (d.source === "photo") imageUrl = originalUrl;
    }
  }

  const customerRow = (customers.data ?? []).find((c: any) => c.id === o.customer_id);

  return {
    id: o.id,
    status: o.status,
    customerId: o.customer_id,
    customerRaw: o.customer_raw,
    customerRef: o.customer_ref,
    deliveryDate: o.delivery_date,
    deliveryReason: o.delivery_reason,
    deliveryRef: o.delivery_ref,
    poNumber: o.po_number,
    notes: o.notes,
    duplicateOf: o.duplicate_of,
    approvedAt: o.approved_at,
    customer: customerRow ? { id: customerRow.id, name: customerRow.name, short: customerRow.short, days: customerRow.delivery_days } : null,
    lines: (lines.data ?? []).map((l: any) => {
      const p = one<any>(l.products);
      return {
        lineNo: l.line_no,
        rawText: l.raw_text,
        productText: l.product_text,
        productId: l.product_id,
        productName: p?.name ?? null,
        sku: p?.sku ?? null,
        qty: l.qty == null ? null : Number(l.qty),
        qtyEach: l.qty_each == null ? null : Number(l.qty_each),
        unitRaw: l.unit_raw,
        method: l.match_method,
        score: l.match_score == null ? null : Number(l.match_score),
        source: l.source_ref,
        removed: l.removed,
      };
    }),
    flags: (flags.data ?? [])
      .map((f: any) => ({
        id: f.id,
        code: f.code,
        severity: f.severity,
        message: f.message,
        lineNo: f.line_no,
        data: f.data ?? {},
        resolvedAt: f.resolved_at,
        resolution: f.resolution,
      }))
      .sort((a: FlagView, b: FlagView) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    document: d
      ? {
          id: d.id,
          source: d.source,
          title: d.title,
          sender: d.sender,
          receivedAt: d.received_at,
          status: d.status,
          error: d.error,
          layer: d.text_layer,
          body: d.body_text,
          imageUrl,
          originalUrl,
          sampleKey: d.sample_key,
        }
      : null,
    reading: reading.data ? (reading.data as ReadingMeta) : null,
    products: products.data ?? [],
    customers: (customers.data ?? []).map((c: any) => ({ id: c.id, name: c.name })),
  };
}

/** The next order to review: one needing a check first, then one that's ready. */
export async function loadNextOrderId(sb: SupabaseClient, wsId: string, exclude: string | null): Promise<string | null> {
  const { data } = await sb
    .from("documents")
    .select("status,received_at,orders(id)")
    .eq("workspace_id", wsId)
    .in("status", ["needs_check", "ready"])
    .order("received_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []).map((d: any) => ({ status: d.status, id: one<any>(d.orders)?.id as string | undefined }));
  for (const status of ["needs_check", "ready"]) {
    const hit = rows.find((r) => r.status === status && r.id && r.id !== exclude);
    if (hit?.id) return hit.id;
  }
  return null;
}
