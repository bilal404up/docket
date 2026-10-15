/*
  Captures a model's reading of each text-based sample, so the demo can replay it
  without a paid call. Needs OPENAI_API_KEY in .env.local. Photos are skipped.
  Run: npm run pre-read
*/
import { writeFileSync } from "node:fs";
import path from "node:path";
import { liveModel, readWithModel } from "@/lib/ai/read";
import { layerToText } from "@/lib/pipeline/locate";
import { SAMPLES } from "@/lib/samples";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in .env.local first.");
  const out: Record<string, unknown> = {};
  for (const s of SAMPLES) {
    if (s.source === "photo") continue;
    const text = s.body ?? layerToText(s.layer);
    process.stdout.write(`Reading ${s.key}... `);
    const reading = await readWithModel({ source: s.source, text });
    out[s.key] = { model: liveModel(), captured: new Date().toISOString().slice(0, 10), reading };
    console.log("done");
  }
  const file = path.join(process.cwd(), "lib", "samples", "captured.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`Saved ${Object.keys(out).length} readings to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
