import { describe, expect, it } from "vitest";
import { SAMPLES, readingFor } from "@/lib/samples";
import { processReading } from "@/lib/pipeline/process";
import { staticCtx } from "@/lib/pipeline/static-ctx";
import { storyAt } from "@/lib/clock";
import { BAKERY } from "@/lib/seed/catalog";

// Wednesday of the story week, bakery clock. Each sample arrives at its own time.
const STORY = "2026-10-14";

describe("sample documents", () => {
  for (const s of SAMPLES) {
    it(`${s.key} produces the flags it is built for`, () => {
      const { reading } = readingFor(s);
      const ctx = staticCtx(storyAt(STORY, s.received));
      if (s.key === "kettle-resend") {
        // The resend only counts as a duplicate when the first order is already in the sandbox.
        const first = processReading(readingFor(SAMPLES[0]).reading, SAMPLES[0].layer, staticCtx(storyAt(STORY, SAMPLES[0].received)));
        ctx.existing.push({ orderId: "first", customerId: "kettle", date: first.deliveryDate!, signature: first.signature, label: "the first order" });
      }
      const draft = processReading(reading, s.layer, ctx);
      for (const want of s.expected) {
        const hit = draft.flags.some((f) => f.code === want.code && (want.line === null || f.lineNo === want.line));
        expect(hit, `${s.key} should flag ${want.code}${want.line ? ` on line ${want.line}` : ""}`).toBe(true);
      }
    });
  }

  it("clean samples raise no blocker or check", () => {
    for (const s of SAMPLES.filter((x) => x.expected.length === 0)) {
      const draft = processReading(readingFor(s).reading, s.layer, staticCtx(storyAt(STORY, s.received)));
      expect(draft.flags.filter((f) => f.severity !== "info"), s.key).toEqual([]);
    }
  });

  it("the cut-off is 8 pm the evening before", () => {
    expect(BAKERY.cutoffHour).toBe(20);
  });
});
