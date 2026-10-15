import { DemoStart } from "@/components/DemoStart";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Opening the demo" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  return (
    <main id="main" className="wrap grid min-h-screen content-center gap-6 py-16">
      <Wordmark />
      <DemoStart />
    </main>
  );
}
