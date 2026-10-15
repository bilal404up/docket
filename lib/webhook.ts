import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "@/lib/workspace";

export const SIGNATURE_HEADER = "docket-signature";

/** Stripe-style signature: t=<unix seconds>,v1=<HMAC-SHA256 of "t.body">. */
export function signBody(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/** Constant-time check, with a five-minute window so an old delivery can't be replayed. */
export function verifySignature(secret: string, body: string, header: string | null, toleranceSec = 300, now = Date.now()): boolean {
  const parts: Record<string, string> = {};
  for (const piece of (header ?? "").split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Sends a signed event to the sandbox's built-in inspector, which verifies it and records the delivery. */
export async function deliverWebhook(
  sb: SupabaseClient,
  ws: Workspace,
  origin: string,
  event: string,
  data: Record<string, unknown>,
): Promise<number> {
  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), workspace: ws.id, data });
  const signature = signBody(ws.webhook_secret, body);
  const res = await fetch(`${origin}/api/webhook-inspector/${ws.id}`, {
    method: "POST",
    headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
    body,
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!res) {
    await sb.from("webhook_deliveries").insert({
      workspace_id: ws.id,
      order_id: typeof data.order_id === "string" ? data.order_id : null,
      event,
      payload: JSON.parse(body),
      signature,
      status: 0,
      verified: false,
      note: "Couldn't reach the endpoint",
    });
    return 0;
  }
  return res.status;
}
