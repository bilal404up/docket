import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function Landing() {
  return (
    <main id="main" className="min-h-screen">
      <header className="wrap flex h-16 items-center justify-between">
        <Wordmark />
        <Link href="/demo" className="btn btn-primary">Open the demo</Link>
      </header>

      <section className="wrap grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-20">
        <div>
          <p className="label">Demo, invented data</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Messy orders in. Checked data out.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
            Cafés send wholesale orders as PDFs, emails, phone photos and spreadsheet exports. Docket reads each one, matches the items to the catalog, and flags anything doubtful with a plain reason. A person approves it, and it lands on the bake sheet.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="btn btn-primary">Open the demo</Link>
            <a href="#how" className="btn btn-quiet">How it works</a>
          </div>
          <p className="mt-4 text-sm text-ink-muted">A private sandbox for you, with a made-up bakery. It clears after 24 hours.</p>
        </div>

        <div className="card fade-in grid gap-3 p-5" aria-label="Example order">
          <p className="label">One order, before and after</p>
          <p className="mono rounded-control bg-canvas p-3 text-sm">4 sour lg<br />2 doz croissants<br />6 almond crossaints<br />same drop-off as always</p>
          <ul className="grid gap-2 text-sm">
            <li className="rounded-control border border-line p-3">Sour lg matched to <strong>Sourdough, large</strong> by similarity.</li>
            <li className="rounded-control border border-line p-3">2 doz became <strong>24</strong> croissants.</li>
            <li className="rounded-control border border-amber-ink/40 bg-amber-tint p-3 text-amber-ink">Crossaints was matched to Almond croissant by similarity. Confirm it, and the next order from this café needs no check.</li>
          </ul>
        </div>
      </section>

      <section id="how" className="border-y border-line bg-paper py-12">
        <div className="wrap grid gap-6 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold">The AI reads, the code decides</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">The model only transcribes. Matching, dates, cut-offs, units and duplicates are plain rules, so every decision has a reason you can read.</p>
          </div>
          <div>
            <h2 className="font-semibold">Nothing is guessed silently</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">Each doubtful item is flagged, with the words it came from highlighted on the document. A person decides.</p>
          </div>
          <div>
            <h2 className="font-semibold">Approval is signed</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">An approved order sends a signed webhook to an endpoint you can inspect, the way a client&apos;s own system would receive it.</p>
          </div>
        </div>
      </section>

      <footer className="wrap flex flex-col gap-2 py-8 text-sm text-ink-muted sm:flex-row sm:justify-between">
        <p>Demo built by Bilal for his portfolio. The bakery, cafés, products and documents are invented.</p>
        <p>Live AI reading is off unless the site owner turns it on.</p>
      </footer>
    </main>
  );
}
