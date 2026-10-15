import { ResetButton } from "@/components/ResetButton";
import { liveReadingEnabled, liveModel } from "@/lib/ai/read";
import { siteOrigin } from "@/lib/origin";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { ws } = await currentWorkspace();
  if (!ws) return null;
  const endpoint = `${siteOrigin()}/api/webhook-inspector/${ws.id}`;
  const live = liveReadingEnabled();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Your sandbox, how it is read, and how an order reaches another system.</p>
      </div>

      <section aria-labelledby="reading" className="card grid gap-2 p-4">
        <h2 id="reading" className="font-semibold">How documents are read</h2>
        <p className="text-sm text-ink-muted">
          {live
            ? `Live reading is on, using ${liveModel()}. Each upload you add costs a small amount, and there is a daily limit per sandbox.`
            : "Live reading is off, so no paid AI runs in this demo. The ten samples use readings saved from a model, and the checks run live on those readings."}
        </p>
      </section>

      <section aria-labelledby="hook" className="card grid gap-2 p-4">
        <h2 id="hook" className="font-semibold">Webhook endpoint</h2>
        <p className="text-sm text-ink-muted">Approved orders are sent here, signed with this sandbox&apos;s secret. The built-in inspector checks the signature the way a real client system would.</p>
        <p className="mono break-all rounded-control bg-canvas p-3 text-xs">POST {endpoint}</p>
        <p className="text-xs text-ink-muted">Header <span className="mono">docket-signature</span>: t=timestamp,v1=HMAC-SHA256 of the timestamp, a dot and the body.</p>
      </section>

      <section aria-labelledby="reset" className="card grid gap-2 p-4">
        <h2 id="reset" className="font-semibold">Start again</h2>
        <p className="text-sm text-ink-muted">Clears this sandbox and opens a fresh bakery with its history and tonight&apos;s orders.</p>
        <div>
          <ResetButton />
        </div>
      </section>
    </div>
  );
}
