import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ResetButton } from "@/components/ResetButton";
import { Wordmark } from "@/components/Wordmark";
import { contextLine, hoursLeft } from "@/lib/clock";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { ws } = await currentWorkspace();
  if (!ws) redirect("/demo");
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="no-print border-b border-ember/30 bg-ember-tint">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm text-ember-deep">
          <p>
            <strong>Demo, invented data.</strong> {ws.name} is a made-up bakery. Your sandbox is private and clears in about {hoursLeft(ws.expires_at)}h.
          </p>
          <ResetButton className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4" />
        </div>
      </div>
      <div className="wrap grid gap-6 py-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="no-print hidden lg:block">
          <div className="sticky top-4 grid gap-4">
            <Wordmark href="/app" />
            <AppNav variant="rail" />
            <p className="text-xs leading-relaxed text-ink-muted">{contextLine(ws)}</p>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="no-print mb-3 flex items-center justify-between gap-3 lg:hidden">
            <Wordmark href="/app" />
            <p className="text-right text-xs text-ink-muted">{contextLine(ws)}</p>
          </div>
          <main id="main">{children}</main>
        </div>
      </div>
      <div className="no-print">
        <AppNav variant="bar" />
      </div>
    </div>
  );
}
