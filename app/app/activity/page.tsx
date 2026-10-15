import { TestWebhook } from "@/components/TestWebhook";
import { loadActivity } from "@/lib/data/activity";
import { toStory } from "@/lib/clock";
import { fmtTime } from "@/lib/pipeline/dates";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { sb, ws } = await currentWorkspace();
  if (!ws) return null;
  const { events, deliveries, edits } = await loadActivity(sb, ws.id);
  const approved = events.filter((e) => e.type === "order.approved").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-ink-muted">Every change in this sandbox, and every signed webhook sent when an order is approved.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="label">Approved</p>
          <p className="mono mt-1 text-2xl">{approved}</p>
        </div>
        <div className="card p-4">
          <p className="label">Your corrections</p>
          <p className="mono mt-1 text-2xl">{edits}</p>
        </div>
        <div className="card p-4">
          <p className="label">Webhooks</p>
          <p className="mono mt-1 text-2xl">{deliveries.length}</p>
        </div>
      </div>

      <section aria-labelledby="hooks" className="grid gap-2">
        <h2 id="hooks" className="label">Webhook deliveries</h2>
        <TestWebhook />
        <ul className="grid gap-2">
          {deliveries.map((d) => (
            <li key={d.id} className="card p-3">
              <p className="text-sm font-semibold">
                {d.event} <span className={d.verified ? "text-teal-ink" : "text-red-ink"}>{d.status}</span>
              </p>
              <p className="text-xs text-ink-muted">{d.note}</p>
              <details className="mt-2">
                <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold">Payload and signature</summary>
                <pre className="mono mt-1 overflow-x-auto rounded-control bg-canvas p-3 text-xs">{`docket-signature: ${d.signature}\n\n${JSON.stringify(d.payload, null, 2)}`}</pre>
              </details>
            </li>
          ))}
          {!deliveries.length ? <li className="text-sm text-ink-muted">No deliveries yet. Approve an order, or send a test event.</li> : null}
        </ul>
      </section>

      <section aria-labelledby="log" className="grid gap-2">
        <h2 id="log" className="label">Log</h2>
        <ol className="card divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[4.5rem_1fr] gap-3 p-3 text-sm">
              <span className="mono text-xs text-ink-muted">{fmtTime(toStory(ws, e.at))}</span>
              <span>{e.summary}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
