"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/* Signs the visitor in anonymously and opens their private sandbox. */
export function DemoStart() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  async function go() {
    setState("working");
    try {
      const sb = createBrowserSupabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw new Error("Sign-in is not available right now.");
      }
      const res = await fetch("/api/demo/start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "The sandbox could not be opened.");
      router.replace("/app");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state === "working" ? (
    <p role="status" className="text-ink-muted">Setting up your sandbox: a bakery, eight cafés, three weeks of history and tonight&apos;s orders. A few seconds.</p>
  ) : (
    <div role="alert">
      <p className="text-red-ink">{message}</p>
      <button type="button" className="btn btn-primary mt-4" onClick={() => void go()}>Try again</button>
    </div>
  );
}
