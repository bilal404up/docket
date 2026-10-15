import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-tag bg-ink font-mono text-sm text-white">D</span>
      Docket
    </Link>
  );
}
