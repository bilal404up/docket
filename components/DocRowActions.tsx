"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDocument } from "@/lib/actions";

export function DocRowActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch(`/api/documents/${documentId}/retry`, { method: "POST" }).catch(() => null);
            const json = await res?.json().catch(() => null);
            if (!res || !res.ok || json?.error) setError(json?.error ?? "Could not try again.");
            router.refresh();
          })
        }
      >
        Read it again
      </button>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteDocument(documentId);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
      >
        Delete
      </button>
      {error ? <span role="alert" className="text-xs text-red-ink">{error}</span> : null}
    </div>
  );
}
