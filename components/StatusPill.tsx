import type { DocStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

const MAP: Record<DocStatus, { text: string; cls: string }> = {
  reading: { text: "Reading", cls: "bg-canvas text-ink-muted" },
  ready: { text: "Ready", cls: "bg-teal-tint text-teal-ink" },
  needs_check: { text: "Needs a check", cls: "bg-amber-tint text-amber-ink" },
  approved: { text: "Approved", cls: "bg-teal-tint text-teal-ink" },
  rejected: { text: "Rejected", cls: "bg-canvas text-ink-muted" },
  failed: { text: "Couldn't read", cls: "bg-red-tint text-red-ink" },
};

export function StatusPill({ status }: { status: DocStatus }) {
  const m = MAP[status];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", m.cls)}>{m.text}</span>;
}
