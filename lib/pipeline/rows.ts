import type { Draft } from "./process";

/** Database rows for a draft, ready to insert. */
export function draftToRows(workspaceId: string, documentId: string | null, draft: Draft) {
  const orderId = crypto.randomUUID();
  const status = draft.flags.some((f) => f.severity !== "info") ? "needs_check" : "ready";
  return {
    orderId,
    status,
    order: {
      id: orderId,
      workspace_id: workspaceId,
      document_id: documentId,
      customer_id: draft.customerId,
      customer_raw: draft.customerRaw,
      customer_ref: draft.customerRef,
      delivery_date: draft.deliveryDate,
      delivery_reason: draft.deliveryReason,
      delivery_ref: draft.deliveryRef,
      po_number: draft.poNumber,
      notes: draft.notes,
      duplicate_of: draft.duplicateOf,
      status: "draft",
    },
    lines: draft.lines.map((l) => ({
      workspace_id: workspaceId,
      order_id: orderId,
      line_no: l.lineNo,
      raw_text: l.rawText,
      product_text: l.productText,
      product_id: l.productId,
      qty: l.qty,
      unit_raw: l.unitRaw,
      qty_each: l.qtyEach,
      match_method: l.method,
      match_score: l.score,
      source_ref: l.source,
    })),
    flags: draft.flags.map((f) => ({
      workspace_id: workspaceId,
      order_id: orderId,
      line_no: f.lineNo,
      code: f.code,
      severity: f.severity,
      message: f.message,
      data: f.data,
    })),
  };
}
