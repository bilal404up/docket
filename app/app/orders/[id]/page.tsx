import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/ReviewClient";
import { StatusPill } from "@/components/StatusPill";
import { loadOrder } from "@/lib/data/order";
import { currentWorkspace } from "@/lib/workspace";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: { id: string } }) {
  const { sb, ws } = await currentWorkspace();
  if (!ws) return null;
  const order = await loadOrder(sb, ws, params.id);
  if (!order) notFound();
  const name = order.customer?.name ?? order.customerRaw ?? "Unknown café";
  return (
    <div className="grid gap-2">
      <div>
        <Link href="/app" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ember-deep underline underline-offset-4">
          Inbox
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {order.document ? <StatusPill status={order.document.status} /> : null}
        </div>
      </div>
      <ReviewClient order={order} />
    </div>
  );
}
