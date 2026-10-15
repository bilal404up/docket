import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Supabase client for server components, server actions and route handlers. Row-level security applies. */
export function createClient() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: any }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't set cookies. The middleware keeps the session fresh instead.
        }
      },
    },
  });
}
