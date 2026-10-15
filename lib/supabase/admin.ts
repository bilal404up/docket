import { createClient } from "@supabase/supabase-js";

/**
  Service-role client: bypasses row-level security. Server only. It is used by
  the webhook inspector (to look up a sandbox's signing secret) and the nightly
  cleanup. Never import this into a client component.
*/
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
