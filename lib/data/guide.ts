import type { SupabaseClient } from "@supabase/supabase-js";

export const FIX_EVENTS = ["line.product", "line.confirmed", "line.qty", "line.removed", "flag.accepted", "order.customer", "order.date"];

/** Progress through the guided path, worked out from the sandbox's own activity log. */
export async function loadGuide(sb: SupabaseClient, wsId: string) {
  const { data } = await sb.from("events").select("type,payload").eq("workspace_id", wsId).limit(500);
  const events = (data ?? []) as { type: string; payload: Record<string, any> }[];
  return {
    approved: events.some((e) => e.type === "order.approved"),
    fixed: events.some((e) => FIX_EVENTS.includes(e.type)),
    repeat: events.some((e) => e.type === "document.read" && e.payload?.sample_key === "longtable-email"),
    added: events.some((e) => e.type === "document.read" && e.payload?.by === "visitor" && (e.payload?.via === "file" || e.payload?.via === "text")),
  };
}
