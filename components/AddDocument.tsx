"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { IngestResult } from "@/lib/pipeline/run";

export type TraySample = { key: string; title: string; sender: string; tests: string; source: string; inInbox: boolean };

export function AddDocument({ samples, liveOn }: { samples: TraySample[]; liveOn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function send(label: string, init: RequestInit) {
    setBusy(label);
    setError(null);
    setResult(null);
    const res = await fetch("/api/documents", init).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res || !res.ok || json?.error) setError(json?.error ?? "That did not work. Try again.");
    else {
      setResult(json as IngestResult);
      router.refresh();
    }
    setBusy(null);
  }

  const tray = samples.filter((s) => !s.inInbox);
  const rest = samples.filter((s) => s.inInbox);

  return (
    <div className="grid gap-6">
      <section aria-labelledby="tray" className="card p-4">
        <h2 id="tray" className="text-lg font-semibold">Waiting in the tray</h2>
        <p className="mt-1 text-sm text-ink-muted">These arrived tonight but are not in the inbox yet. Add one and watch it being read.</p>
        <ul className="mt-3 grid gap-2">
          {tray.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-ink-muted">{s.tests}</p>
              </div>
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => send(s.key, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sampleKey: s.key }) })}>
                {busy === s.key ? "Reading…" : "Add to the inbox"}
              </button>
            </li>
          ))}
          {!tray.length ? <li className="text-sm text-ink-muted">The tray is empty.</li> : null}
        </ul>
      </section>

      <section aria-labelledby="upload" className="card p-4">
        <h2 id="upload" className="text-lg font-semibold">Upload a file</h2>
        <p className="mt-1 text-sm text-ink-muted">
          PDF, JPG, PNG, WebP or text, up to 4 MB. {liveOn ? "Your own files are read by a live model, with a small daily limit." : "Live reading is off in this demo, so no paid AI runs. Download a sample below and upload it back to use the real upload path."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv" className="field max-w-sm py-2" aria-label="Choose a file" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => {
              const f = file.current?.files?.[0];
              if (!f) return setError("Choose a file first.");
              const form = new FormData();
              form.append("file", f);
              void send("upload", { method: "POST", body: form });
            }}
          >
            {busy === "upload" ? "Reading…" : "Upload and read"}
          </button>
        </div>
        <details className="mt-4">
          <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-semibold">Samples to download</summary>
          <ul className="grid gap-1 pb-2 text-sm">
            {samples.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{s.title}</span>
                <a className="inline-flex min-h-[44px] items-center font-semibold text-ember-deep underline underline-offset-4" href={`/api/samples/${s.key}?download=1`}>Download</a>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="paste" className="card p-4">
        <h2 id="paste" className="text-lg font-semibold">Paste an email</h2>
        <label className="mt-2 block">
          <span className="sr-only">Email or CSV text</span>
          <textarea className="field min-h-[9rem] py-2 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an order email or a CSV export" />
        </label>
        <button type="button" className="btn btn-primary mt-3" disabled={busy !== null || !text.trim()} onClick={() => send("paste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })}>
          {busy === "paste" ? "Reading…" : "Read this text"}
        </button>
        <p className="mt-2 text-xs text-ink-muted">{rest.length ? "Tip: pasting the text of one of the sample emails uses its saved reading." : ""}</p>
      </section>

      {error ? <p role="alert" className="rounded-control border border-red-ink/40 bg-red-tint p-3 text-sm text-red-ink">{error}</p> : null}

      {result ? (
        <section aria-label="Result" className="card fade-in p-4" role="status">
          <h2 className="text-lg font-semibold">{result.error ? "Could not read it" : "Read and checked"}</h2>
          <ol className="mt-3 grid gap-2">
            {result.steps.map((s) => (
              <li key={s.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-sm last:border-0">
                <span className="font-semibold">{s.label}</span>
                <span className="text-ink-muted">{s.note}</span>
                <span className="mono text-xs text-ink-muted">{s.ms} ms</span>
              </li>
            ))}
          </ol>
          {result.orderId ? (
            <Link href={`/app/orders/${result.orderId}`} className="btn btn-primary mt-4">Open the order</Link>
          ) : (
            <Link href="/app" className="btn btn-quiet mt-4">Go to the inbox</Link>
          )}
        </section>
      ) : null}
    </div>
  );
}
