import type { SupabaseClient } from "@supabase/supabase-js";

/** Writes one line to the sandbox's activity log. A failed write never breaks the action that caused it. */
export async function logEvent(
  sb: SupabaseClient,
  workspaceId: string,
  type: string,
  summary: string,
  payload: Record<string, unknown> = {},
) {
  const { error } = await sb.from("events").insert({ workspace_id: workspaceId, type, summary, payload });
  if (error) console.error("Event not logged:", error.message);
}
