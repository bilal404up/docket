import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type Workspace = {
  id: string;
  name: string;
  story_date: string;
  created_at: string;
  expires_at: string;
  webhook_secret: string;
};

const COLUMNS = "id,name,story_date,created_at,expires_at,webhook_secret";

/** The signed-in visitor's sandbox, or null if they have none or it has expired. */
export async function fetchWorkspace(sb: SupabaseClient): Promise<Workspace | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("workspaces")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || Date.parse(data.expires_at) < Date.now()) return null;
  return data as Workspace;
}

export async function requireWorkspace(sb: SupabaseClient): Promise<Workspace> {
  const ws = await fetchWorkspace(sb);
  if (!ws) throw new UserError("no_workspace", "Your demo sandbox has expired. Start a fresh one.");
  return ws;
}

/** For server components: one lookup per request, shared by the layout and the page. */
export const currentWorkspace = cache(async () => {
  const sb = createClient();
  return { sb, ws: await fetchWorkspace(sb) };
});
