import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { createSandbox } from "@/lib/seed/seed";
import { removeWorkspaceFiles } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { fetchWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Your session ended. Open the demo again." }, { status: 401 });
    const old = await fetchWorkspace(sb);
    if (old) await removeWorkspaceFiles(sb, old.id);
    const ws = await createSandbox(sb);
    return NextResponse.json({ ok: true, workspaceId: ws.id });
  } catch (e) {
    return jsonError(e);
  }
}
