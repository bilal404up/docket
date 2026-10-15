import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { createSandbox } from "@/lib/seed/seed";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { fetchWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Opens the visitor's sandbox. Reuses one that is still open, so revisiting /demo never wipes work. */
export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign-in didn't finish. Reload the page and try again." }, { status: 401 });

    const existing = await fetchWorkspace(sb);
    if (existing) return NextResponse.json({ ok: true, workspaceId: existing.id, reused: true });

    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    if (!(await verifyTurnstile(body?.token, ip))) {
      return NextResponse.json({ error: "The quick check didn't pass. Try again." }, { status: 400 });
    }

    const ws = await createSandbox(sb);
    return NextResponse.json({ ok: true, workspaceId: ws.id, reused: false });
  } catch (e) {
    return jsonError(e);
  }
}
