import type { SupabaseClient } from "@supabase/supabase-js";
import { must } from "@/lib/errors";

export type ActivityEvent = { id: string; type: string; summary: string; at: string; payload: Record<string, any> };
export type Delivery = {
  id: string;
  event: string;
  status: number;
  verified: boolean;
  note: string | null;
  signature: string;
  payload: Record<string, any>;
  at: string;
};

export async function loadActivity(sb: SupabaseClient, wsId: string) {
  const [events, deliveries, edits] = await Promise.all([
    must(sb.from("events").select("id,type,summary,payload,created_at").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200)),
    must(
      sb
        .from("webhook_deliveries")
        .select("id,event,status,verified,note,signature,payload,created_at")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(25),
    ),
    must(sb.from("field_edits").select("id", { count: "exact", head: true }).eq("workspace_id", wsId)),
  ]);
  return {
    events: (events.data ?? []).map((e: any): ActivityEvent => ({ id: e.id, type: e.type, summary: e.summary, at: e.created_at, payload: e.payload ?? {} })),
    deliveries: (deliveries.data ?? []).map(
      (d: any): Delivery => ({
        id: d.id,
        event: d.event,
        status: d.status,
        verified: d.verified,
        note: d.note,
        signature: d.signature,
        payload: d.payload,
        at: d.created_at,
      }),
    ),
    edits: edits.count ?? 0,
  };
}
