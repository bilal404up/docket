import type { FlagCode } from "@/lib/types";

export const FLAG_TITLE: Record<FlagCode, string> = {
  customer_unrecognized: "Café not recognized",
  unknown_product: "Not in the catalog",
  qty_unreadable: "Quantity unclear",
  fuzzy_match: "Matched by similarity",
  ambiguous_unit: "Unknown unit",
  unit_converted: "Unit converted",
  repeat_resolved: "Repeat order",
  duplicate: "Possible duplicate",
  unusual_qty: "Unusual quantity",
  day_not_served: "Not a delivery day",
  after_cutoff: "After the cutoff",
  date_defaulted: "Date filled in",
  date_past: "Date has passed",
};

export const DATE_CODES: FlagCode[] = ["day_not_served", "after_cutoff", "date_past", "date_defaulted"];

type FlagLike = { severity: string; resolved_at?: string | null; resolvedAt?: string | null };

export function openCounts(flags: FlagLike[]) {
  let blockers = 0;
  let checks = 0;
  for (const f of flags) {
    if (f.resolved_at ?? f.resolvedAt) continue;
    if (f.severity === "blocker") blockers++;
    else if (f.severity === "check") checks++;
  }
  return { blockers, checks };
}

export function countsLabel(blockers: number, checks: number) {
  const parts: string[] = [];
  if (blockers) parts.push(`${blockers} must fix`);
  if (checks) parts.push(`${checks} to check`);
  return parts.join(" · ");
}
