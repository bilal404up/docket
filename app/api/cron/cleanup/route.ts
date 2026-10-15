import { NextResponse } from "next/server";
import { removeWorkspaceFiles } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Nightly: deletes expired sandboxes, their files and the anonymous accounts that owned them. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: expired } = await admin
    .from("workspaces")
    .select("id,memberships(user_id)")
    .lt("expires_at", new Date().toISOString())
    .limit(100);

  const users = new Set<string>();
  for (const ws of (expired ?? []) as any[]) {
    for (const m of ws.memberships ?? []) users.add(m.user_id);
    await removeWorkspaceFiles(admin, ws.id);
    await admin.from("workspaces").delete().eq("id", ws.id);
  }

  let deletedUsers = 0;
  for (const id of Array.from(users)) {
    const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", id);
    if (count) continue;
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.is_anonymous) {
      await admin.auth.admin.deleteUser(id);
      deletedUsers++;
    }
  }
  return NextResponse.json({ workspaces: expired?.length ?? 0, users: deletedUsers });
}
