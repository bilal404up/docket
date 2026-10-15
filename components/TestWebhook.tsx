"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendTestWebhook } from "@/lib/actions";

export function TestWebhook() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn btn-quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestWebhook();
            setMsg(r.ok ? (r.status === 200 ? "Delivered and verified (200)." : `The endpoint answered ${r.status}.`) : r.error);
            router.refresh();
          })
        }
      >
        Send a test event
      </button>
      {msg ? <p role="status" className="mt-2 text-sm text-ink-muted">{msg}</p> : null}
    </div>
  );
}
