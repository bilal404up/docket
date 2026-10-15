"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptFlag, approveOrder, confirmMatch, rejectOrder, removeLine, setCustomer, setDeliveryDate, setLineProduct, setLineQty, type ActionResult } from "@/lib/actions";
import type { FlagView, LineView, OrderView } from "@/lib/data/order";
import { FLAG_TITLE, openCounts } from "@/lib/flags";
import { fmtDay, fmtLongDate } from "@/lib/pipeline/dates";
import type { SourceRef } from "@/lib/types";
import { cx } from "@/lib/cx";
import { DocViewer } from "./DocViewer";

const METHOD: Record<string, string> = {
  exact: "Exact name",
  alias: "Known nickname",
  learned: "Learned from this café",
  fuzzy: "Matched by similarity",
  manual: "Set by you",
  repeat: "Copied from last order",
  none: "No match",
};

function Tag({ n }: { n: number | null }) {
  return <span className="tag bg-ink text-white">{n ? `L${n}` : "ORDER"}</span>;
}

const SEV = {
  blocker: { box: "border-red-ink/40 bg-red-tint", word: "Must fix", wordCls: "text-red-ink" },
  check: { box: "border-amber-ink/40 bg-amber-tint", word: "Check", wordCls: "text-amber-ink" },
  info: { box: "border-line bg-canvas", word: "Note", wordCls: "text-ink-muted" },
} as const;

export function ReviewClient({ order }: { order: OrderView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SourceRef | null>(null);
  const [remember, setRemember] = useState(true);
  const [done, setDone] = useState<{ next: string | null; date: string; items: number } | null>(null);

  const locked = order.status !== "draft";
  const { blockers, checks } = openCounts(order.flags);
  const lines = order.lines.filter((l) => !l.removed);
  const open = order.flags.filter((f) => !f.resolvedAt);
  const closed = order.flags.filter((f) => f.resolvedAt);

  function call<T extends object>(fn: () => Promise<ActionResult<T>>, after?: (r: T) => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      after?.(r as unknown as T);
      router.refresh();
    });
  }

  const lineFlags = (n: number) => order.flags.filter((f) => f.lineNo === n && !f.resolvedAt && f.severity !== "info");

  const flagCard = (f: FlagView) => {
    const s = SEV[f.severity];
    return (
      <li key={f.id} className={cx("rounded-control border p-3", s.box)}>
        <div className="flex flex-wrap items-center gap-2">
          <Tag n={f.lineNo} />
          <span className={cx("text-xs font-bold uppercase tracking-wide", s.wordCls)}>{s.word}</span>
          <span className="text-sm font-semibold">{FLAG_TITLE[f.code]}</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed">{f.message}</p>
        {f.resolvedAt ? <p className="mt-1.5 text-xs text-ink-muted">Resolved: {f.resolution}</p> : null}
        {!locked && !f.resolvedAt && f.severity === "check" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {f.code === "fuzzy_match" && f.lineNo ? (
              <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call(() => confirmMatch(order.id, f.lineNo!, remember))}>
                Yes, that is right
              </button>
            ) : (
              <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call(() => acceptFlag(f.id))}>
                Keep it as it is
              </button>
            )}
            {f.data?.suggest ? (
              <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call(() => setDeliveryDate(order.id, String(f.data.suggest)))}>
                Move to {fmtDay(String(f.data.suggest))}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  const lineCard = (l: LineView) => {
    const lf = lineFlags(l.lineNo);
    const ring = lf.some((f) => f.severity === "blocker") ? "border-red-ink/50" : lf.length ? "border-amber-ink/50" : "border-line";
    return (
      <li key={l.lineNo} className={cx("card p-3", ring)} onMouseEnter={() => setActive(l.source)} onFocus={() => setActive(l.source)}>
        <div className="flex flex-wrap items-center gap-2">
          <Tag n={l.lineNo} />
          <span className="min-w-0 flex-1 truncate text-sm text-ink-muted" title={l.rawText}>
            Read as <span className="mono text-ink">{l.rawText || l.productText}</span>
          </span>
          <span className="text-xs text-ink-muted">
            {METHOD[l.method] ?? l.method}
            {l.score != null && l.method === "fuzzy" ? ` ${l.score.toFixed(2)}` : ""}
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
          <label className="block">
            <span className="sr-only">Product for line {l.lineNo}</span>
            <select
              className="field"
              disabled={locked || pending}
              value={l.productId ?? ""}
              onChange={(e) => e.target.value && call(() => setLineProduct(order.id, l.lineNo, e.target.value, remember))}
            >
              <option value="">Choose a product…</option>
              {order.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Quantity for line {l.lineNo}</span>
            <input
              key={`${l.lineNo}-${l.qtyEach}`}
              className="field mono"
              inputMode="numeric"
              placeholder="Qty"
              disabled={locked || pending}
              defaultValue={l.qtyEach ?? ""}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && v !== l.qtyEach) call(() => setLineQty(order.id, l.lineNo, v));
              }}
            />
          </label>
          {!locked ? (
            <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call(() => removeLine(order.id, l.lineNo))} aria-label={`Remove line ${l.lineNo}`}>
              Remove
            </button>
          ) : null}
        </div>
        {l.unitRaw && l.qty != null && l.qtyEach !== l.qty ? (
          <p className="mt-1.5 text-xs text-ink-muted">
            {l.qty} {l.unitRaw} = {l.qtyEach}
          </p>
        ) : null}
        {lf.map((f) => (
          <p key={f.id} className={cx("mt-1.5 text-sm", f.severity === "blocker" ? "text-red-ink" : "text-amber-ink")}>
            {f.message}
          </p>
        ))}
      </li>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <section aria-label="The document" className="lg:sticky lg:top-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label">{order.document?.title ?? "Document"}</h2>
          {order.document?.originalUrl ? (
            <a className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ember-deep underline underline-offset-4" href={order.document.originalUrl} target="_blank" rel="noreferrer">
              Open the original
            </a>
          ) : null}
        </div>
        {order.document ? <DocViewer layer={order.document.layer} imageUrl={order.document.imageUrl} active={active} /> : null}
        <p className="mt-2 text-sm text-ink-muted">Point at a line or a field and its source is outlined here.</p>
        {order.reading ? (
          <p className="mt-3 rounded-control border border-line bg-paper p-3 text-sm text-ink-muted">
            {order.reading.mode === "live"
              ? `Read live by ${order.reading.model}.`
              : order.reading.kind === "model"
                ? `A saved reading by ${order.reading.model}, captured ${order.reading.captured}. Not a live AI call; the checks below ran live.`
                : "A saved reference reading, typed by hand for this demo. Not a live AI call; the checks below ran live."}
          </p>
        ) : null}
      </section>

      <section aria-label="The order" className="grid gap-4">
        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          <label className="block" onMouseEnter={() => setActive(order.customerRef)}>
            <span className="label">Café</span>
            <select className="field mt-1" disabled={locked || pending} value={order.customerId ?? ""} onChange={(e) => e.target.value && call(() => setCustomer(order.id, e.target.value))}>
              <option value="">Choose a café…</option>
              {order.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block" onMouseEnter={() => setActive(order.deliveryRef)}>
            <span className="label">Delivery date</span>
            <input
              type="date"
              className="field mt-1"
              disabled={locked || pending}
              value={order.deliveryDate ?? ""}
              onChange={(e) => e.target.value && call(() => setDeliveryDate(order.id, e.target.value))}
            />
            {order.deliveryReason ? <span className="mt-1 block text-xs text-ink-muted">{order.deliveryReason}</span> : null}
          </label>
          {order.poNumber ? (
            <p className="text-sm">
              <span className="label">PO </span>
              <span className="mono">{order.poNumber}</span>
            </p>
          ) : null}
          {order.notes ? <p className="text-sm text-ink-muted sm:col-span-2">Note on the order: {order.notes}</p> : null}
        </div>

        {open.length ? (
          <div>
            <h2 className="label mb-2">
              {blockers ? `${blockers} must fix` : ""}
              {blockers && checks ? " · " : ""}
              {checks ? `${checks} to check` : ""}
              {!blockers && !checks ? "Notes" : ""}
            </h2>
            <ul className="grid gap-2">
              {open.map((f) => (
                flagCard(f)
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-control border border-teal-ink/30 bg-teal-tint p-3 text-sm text-teal-ink">Nothing is flagged on this order.</p>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="label">
              {lines.length} line{lines.length === 1 ? "" : "s"}
            </h2>
            {!locked ? (
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[#C2410C]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember this café&apos;s wording
              </label>
            ) : null}
          </div>
          <ul className="grid gap-2">
            {lines.map((l) => (
              lineCard(l)
            ))}
          </ul>
        </div>

        {closed.length ? (
          <details className="card p-3 text-sm">
            <summary className="min-h-[44px] cursor-pointer py-3 font-semibold">{closed.length} resolved</summary>
            <ul className="mt-2 grid gap-2">
              {closed.map((f) => (
                flagCard(f)
              ))}
            </ul>
          </details>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-control border border-red-ink/40 bg-red-tint p-3 text-sm text-red-ink">
            {error}
          </p>
        ) : null}

        {done ? (
          <div role="status" className="rounded-control border border-teal-ink/30 bg-teal-tint p-4 text-teal-ink">
            <p className="font-semibold">
              Approved: {done.items} items for {fmtLongDate(done.date)}.
            </p>
            <p className="mt-1 text-sm">It is on the bake sheet now, and a signed webhook was sent.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/app/bake?d=${done.date}`} className="btn btn-primary">
                See the bake sheet
              </Link>
              {done.next ? (
                <Link href={`/app/orders/${done.next}`} className="btn btn-quiet">
                  Next order
                </Link>
              ) : (
                <Link href="/app" className="btn btn-quiet">
                  Back to the inbox
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {locked && !done ? <p className="rounded-control border border-line bg-paper p-3 text-sm text-ink-muted">This order is {order.status}. It is locked.</p> : null}

        {!locked ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || blockers > 0}
              onClick={() => call(() => approveOrder(order.id), (r: any) => setDone({ next: r.next ?? null, date: r.date, items: r.items }))}
            >
              {blockers ? `Fix ${blockers} item${blockers === 1 ? "" : "s"} first` : checks ? `Approve, accepting ${checks} check${checks === 1 ? "" : "s"}` : "Approve"}
            </button>
            <button type="button" className="btn btn-danger" disabled={pending} onClick={() => call(() => rejectOrder(order.id, "Rejected by you"), (r: any) => router.push(r.next ? `/app/orders/${r.next}` : "/app"))}>
              Reject
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
