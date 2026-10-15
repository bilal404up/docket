"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetButton({ className = "btn btn-quiet" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
          if (!res || !res.ok) setError("Reset did not finish. Try again.");
          else {
            router.push("/app");
            router.refresh();
          }
          setBusy(false);
        }}
      >
        {busy ? "Resetting…" : "Reset the demo"}
      </button>
      {error ? <span role="alert" className="text-xs text-red-ink">{error}</span> : null}
    </>
  );
}
