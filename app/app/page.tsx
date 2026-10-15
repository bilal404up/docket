import Link from "next/link";
import { DocRowActions } from "@/components/DocRowActions";
import { StatusPill } from "@/components/StatusPill";
import { cx } from "@/lib/cx";
import { loadGuide } from "@/lib/data/guide";
import { filterRows, inboxCounts, loadInbox, type InboxFilter } from "@/lib/data/inbox";
import { countsLabel } from "@/lib/flags";
import { fmtDay, fmtTime } from "@/lib/pipeline/dates";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

const TABS: { key: InboxFilter; label: string }[] = [
  { key: "check", label: "Needs a check" },
  { key: "ready", label: "Ready" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const ICON: Record<string, string> = { pdf: "PDF", photo: "PHOTO", email: "EMAIL", csv: "CSV" };

export default async function Inbox({ searchParams }: { searchParams: { f?: string } }) {
  const { sb, ws } = await currentWorkspace();
  if (!ws) return null;
  const [rows, guide] = await Promise.all([loadInbox(sb, ws.id), loadGuide(sb, ws.id)]);
  const counts = inboxCounts(rows);
  const f = (TABS.some((t) => t.key === searchParams.f) ? searchParams.f : counts.check ? "check" : "all") as InboxFilter;
  const shown = filterRows(rows, f);

  const steps = [
    { done: guide.fixed, text: "Open an order that needs a check and fix one flag." },
    { done: guide.approved, text: "Approve an order and see it land on the bake sheet." },
    { done: guide.repeat, text: "Add the Long Table email from the tray. It says same as last week." },
    { done: guide.added, text: "Upload a file or paste an email of your own." },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-ink-muted">Tonight&apos;s orders, read and checked. Open one to review it against the original.</p>
      </div>

      <section aria-label="Try this" className="card p-4">
        <h2 className="label">Try this</h2>
        <ol className="mt-2 grid gap-1.5 text-sm">
          {steps.map((s) => (
            <li key={s.text} className="flex gap-2">
              <span aria-hidden="true" className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold", s.done ? "bg-teal-ink text-white" : "border border-edge")}>
                {s.done ? "✓" : ""}
              </span>
              <span className={s.done ? "text-ink-muted line-through" : ""}>{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div role="tablist" aria-label="Filter" className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app?f=${t.key}`}
            role="tab"
            aria-selected={f === t.key}
            className={cx("inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold", f === t.key ? "bg-ink text-white" : "bg-paper text-ink-muted ring-1 ring-inset ring-line")}
          >
            {t.label} <span className="mono text-xs opacity-80">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <ul className="grid gap-2">
        {shown.map((r) => {
          const body = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag bg-canvas text-ink-muted">{ICON[r.source]}</span>
                <StatusPill status={r.status} />
                <span className="text-xs text-ink-muted">arrived {fmtTime(new Date(r.receivedAt))}</span>
              </div>
              <p className="mt-1.5 font-semibold">{r.customer ?? r.title}</p>
              <p className="text-sm text-ink-muted">
                {r.title}
                {r.lines ? ` · ${r.lines} lines` : ""}
                {r.deliveryDate ? ` · for ${fmtDay(r.deliveryDate)}` : ""}
              </p>
              {r.blockers + r.checks ? <p className="mt-1 text-sm text-amber-ink">{countsLabel(r.blockers, r.checks)}</p> : null}
              {r.error ? <p className="mt-1 text-sm text-red-ink">{r.error}</p> : null}
            </>
          );
          return (
            <li key={r.documentId} className="card">
              {r.orderId ? (
                <Link href={`/app/orders/${r.orderId}`} className="block rounded-card p-4 hover:bg-canvas">
                  {body}
                </Link>
              ) : (
                <div className="p-4">
                  {body}
                  {r.status === "failed" ? (
                    <div className="mt-3">
                      <DocRowActions documentId={r.documentId} />
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
        {!shown.length ? <li className="card p-6 text-center text-sm text-ink-muted">Nothing here. Try another tab, or add a document from the tray.</li> : null}
      </ul>
    </div>
  );
}
