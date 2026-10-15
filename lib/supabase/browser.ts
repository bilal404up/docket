import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for the browser. Used only to sign in anonymously on /demo. */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
