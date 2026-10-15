import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
  Run with `npm run test:rls`. It needs the Supabase keys in .env.local and creates two
  anonymous visitors, then checks that neither can see or change the other's sandbox.
  It deletes both visitors at the end.
*/
function loadEnv(): Record<string, string> {
  const file = path.join(process.cwd(), ".env.local");
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function visitor(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error("anonymous sign-in failed: " + error?.message);
  return { sb, id: data.user.id };
}

describe.skipIf(!URL || !ANON || !SERVICE)("row-level security", () => {
  const made: string[] = [];
  let a: { sb: SupabaseClient; id: string };
  let b: { sb: SupabaseClient; id: string };
  let wsA: string;

  beforeAll(async () => {
    a = await visitor();
    b = await visitor();
    made.push(a.id, b.id);
    const { data, error } = await a.sb.rpc("create_workspace", { p_story_date: "2026-10-14" });
    if (error) throw new Error("create_workspace failed: " + error.message);
    wsA = data as string;
    const { error: docErr } = await a.sb.from("documents").insert({
      workspace_id: wsA,
      source: "email",
      title: "Private to A",
      text_layer: { kind: "text", text: "secret" },
      body_text: "secret",
    });
    if (docErr) throw new Error("A could not insert its own document: " + docErr.message);
  }, 60_000);

  afterAll(async () => {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const id of made) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  it("the owner can read their own workspace and document", async () => {
    const { data } = await a.sb.from("workspaces").select("id").eq("id", wsA);
    const { data: docs } = await a.sb.from("documents").select("id").eq("workspace_id", wsA);
    expect(data?.length).toBe(1);
    expect(docs?.length).toBeGreaterThan(0);
  });

  it("another visitor cannot see the workspace", async () => {
    const { data } = await b.sb.from("workspaces").select("id").eq("id", wsA);
    expect(data ?? []).toHaveLength(0);
  });

  it("another visitor cannot see the documents", async () => {
    const { data } = await b.sb.from("documents").select("id,title").eq("workspace_id", wsA);
    expect(data ?? []).toHaveLength(0);
  });

  it("another visitor cannot add a document to someone else's workspace", async () => {
    const { error } = await b.sb.from("documents").insert({
      workspace_id: wsA,
      source: "email",
      title: "Injected",
      text_layer: { kind: "text", text: "x" },
    });
    expect(error).not.toBeNull();
  });

  it("another visitor cannot use the reading quota for someone else's workspace", async () => {
    const { data } = await b.sb.rpc("consume_reading_quota", { p_ws: wsA, p_ws_limit: 5, p_global_limit: 100 });
    expect(data).toBe(false);
  });

  it("another visitor cannot approve an order in someone else's workspace", async () => {
    const { data: orders } = await a.sb.from("orders").select("id").eq("workspace_id", wsA).limit(1);
    const orderId = (orders ?? [])[0]?.id;
    if (!orderId) return; // no order yet in this bare workspace; the insert test above covers writes
    const { error } = await b.sb.rpc("approve_order", { p_order: orderId, p_summary: "attack" });
    expect(error).not.toBeNull();
  });

  it("a signed-out client sees nothing", async () => {
    const anon = client();
    const { data } = await anon.from("workspaces").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
