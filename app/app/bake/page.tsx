import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { bakeDays, loadBakeSheet } from "@/lib/data/bake-sheet";
import { reviewDate } from "@/lib/clock";
import { fmtDay, isDateStr } from "@/lib/pipeline/dates";
import { cx } from "@/lib/cx";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Bake sheet" };
export const dynamic = "force-dynamic";

export default async function BakePage({ searchParams }: { searchParams: { d?: string } }) {
  const { sb, ws } = await currentWorkspace();
  if (!ws) return null;
  const date = isDateStr(searchParams.d) ? searchParams.d : reviewDate(ws);
  const days = bakeDays(ws);
  const sheet = await loadBakeSheet(sb, ws.id, date);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bake sheet, {fmtDay(date)}</h1>
          <p className="mt-1 text-sm text-ink-muted">Totals from approved orders. Pending orders are shown separately and are not baked yet.</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <a className="btn btn-quiet" href={`/api/export/bake-sheet?date=${date}`}>Download CSV</a>
          <a className="btn btn-quiet" href={`/api/export/orders?date=${date}`}>Orders CSV</a>
          <PrintButton />
        </div>
      </div>

      <nav aria-label="Delivery days" className="no-print flex gap-1 overflow-x-auto pb-1">
        {days.map((d) => (
          <Link
            key={d.date}
            href={`/app/bake?d=${d.date}`}
            aria-current={d.date === date ? "date" : undefined}
            className={cx("inline-flex min-h-[44px] shrink-0 items-center rounded-control px-3 text-sm font-semibold", d.date === date ? "bg-ink text-white" : "bg-paper ring-1 ring-inset ring-line", !d.served && "opacity-50")}
          >
            {fmtDay(d.date)}
            {!d.served ? " (closed)" : ""}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="label">Approved items</p>
          <p className="mono mt-1 text-2xl">{sheet.approvedItems}</p>
        </div>
        <div className="card p-4">
          <p className="label">Cafés approved</p>
          <p className="mono mt-1 text-2xl">{sheet.approvedCafes}</p>
        </div>
        <div className="card p-4">
          <p className="label">Still pending</p>
          <p className="mono mt-1 text-2xl">{sheet.pendingOrders}</p>
        </div>
      </div>

      {sheet.sections.length ? (
        sheet.sections.map((s) => (
          <section key={s.dough} aria-labelledby={`dough-${s.dough}`} className="card overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-canvas px-4 py-2">
              <h2 id={`dough-${s.dough}`} className="font-semibold">{s.dough}</h2>
              <p className="mono text-xs text-ink-muted">{s.approved} made · about {s.doughKg} kg dough</p>
            </div>
            <ul className="divide-y divide-line">
              {s.rows.map((r) => (
                <li key={r.productId} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-ink-muted">
                      {r.cafes.filter((c) => c.approved).map((c) => `${c.short} ${c.qty}`).join(" · ") || "No approved orders yet"}
                    </p>
                    {r.cafes.some((c) => !c.approved) ? (
                      <p className="text-xs text-amber-ink">Pending: {r.cafes.filter((c) => !c.approved).map((c) => `${c.short} ${c.qty}`).join(" · ")}</p>
                    ) : null}
                  </div>
                  <p className="mono self-start text-lg sm:text-right">{r.approved}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="card p-6 text-sm text-ink-muted">Nothing is ordered for this day yet.</p>
      )}
    </div>
  );
}
