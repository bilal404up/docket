import { NextResponse } from "next/server";
import { UUID } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNATURE_HEADER, verifySignature } from "@/lib/webhook";

export const runtime = "nodejs";

/**
  A receiving endpoint like a client's own system would have. It checks the
  signature before trusting anything, then records what arrived so the sandbox's
  Activity page can show it. Unsigned or tampered deliveries are recorded as rejected.
*/
export async function POST(req: Request, { params }: { params: { workspace: string } }) {
  if (!UUID.test(params.workspace)) return NextResponse.json({ error: "Unknown endpoint" }, { status: 404 });
  const body = await req.text();
  if (body.length > 64_000) return NextResponse.json({ error: "Too large" }, { status: 413 });

  const admin = createAdminClient();
  const { data: ws } = await admin.from("workspaces").select("id,webhook_secret,expires_at").eq("id", params.workspace).maybeSingle();
  if (!ws || Date.parse(ws.expires_at) < Date.now()) return NextResponse.json({ error: "Unknown endpoint" }, { status: 404 });

  const signature = req.headers.get(SIGNATURE_HEADER);
  const verified = verifySignature(ws.webhook_secret, body, signature);
  let payload: any = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = { raw: body.slice(0, 2000) };
  }
  const status = verified ? 200 : 401;
  await admin.from("webhook_deliveries").insert({
    workspace_id: ws.id,
    order_id: typeof payload?.data?.order_id === "string" && UUID.test(payload.data.order_id) ? payload.data.order_id : null,
    event: typeof payload?.event === "string" ? payload.event.slice(0, 60) : "unknown",
    payload,
    signature: signature ?? "",
    status,
    verified,
    note: verified ? "Signature verified" : "Signature missing or wrong, so the delivery was rejected",
  });
  return NextResponse.json(verified ? { received: true } : { error: "Bad signature" }, { status });
}
