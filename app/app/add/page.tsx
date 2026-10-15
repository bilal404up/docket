import { AddDocument } from "@/components/AddDocument";
import { liveReadingEnabled } from "@/lib/ai/read";
import { SAMPLES } from "@/lib/samples";

export const metadata = { title: "Add a document" };
export const dynamic = "force-dynamic";

export default function AddPage() {
  const samples = SAMPLES.map((s) => ({ key: s.key, title: s.title, sender: s.sender, tests: s.tests, source: s.source, inInbox: s.inInbox }));
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a document</h1>
        <p className="mt-1 text-sm text-ink-muted">Add a sample from the tray, or bring your own. Each one is stored, read, checked against the catalog and saved as a draft order.</p>
      </div>
      <AddDocument samples={samples} liveOn={liveReadingEnabled()} />
    </div>
  );
}
