import type { Run, SourceRef, TextLayer } from "@/lib/types";

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Reading order: top to bottom, then left to right within a line. */
export function orderRuns(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => (Math.abs(a.y - b.y) < 0.004 ? a.x - b.x : a.y - b.y));
}

/** Plain text of a page layer, one line per visual line. */
export function layerToText(layer: TextLayer): string {
  if (layer.kind === "text") return layer.text;
  if (layer.kind !== "pages") return "";
  return layer.pages
    .map((page) => {
      const lines: string[] = [];
      let lastY = -1;
      for (const r of orderRuns(page.runs)) {
        if (lastY >= 0 && Math.abs(r.y - lastY) < 0.004) lines[lines.length - 1] += ` ${r.t}`;
        else lines.push(r.t);
        lastY = r.y;
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
  Finds where a quote sits in the document. PDFs get a box from the text layer,
  text gets a character span, and photos keep the quote only, because there is no
  text layer to place a box on.
*/
export function locate(layer: TextLayer, quote: string): SourceRef {
  const q = quote.trim();
  if (!q) return { kind: "none" };

  if (layer.kind === "text") {
    const i = layer.text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? { kind: "quote", quote: q } : { kind: "span", start: i, end: i + q.length, quote: q };
  }

  if (layer.kind === "pages") {
    const needle = squash(q);
    for (let p = 0; p < layer.pages.length; p++) {
      let text = "";
      const spans: { start: number; end: number; run: Run }[] = [];
      for (const run of orderRuns(layer.pages[p].runs)) {
        if (text) text += " ";
        const start = text.length;
        text += squash(run.t);
        spans.push({ start, end: text.length, run });
      }
      const i = text.indexOf(needle);
      if (i < 0) continue;
      const j = i + needle.length;
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const s of spans) {
        if (s.end <= i || s.start >= j) continue;
        const len = Math.max(1, s.end - s.start);
        const a = (Math.max(i, s.start) - s.start) / len;
        const b = (Math.min(j, s.end) - s.start) / len;
        x0 = Math.min(x0, s.run.x + s.run.w * a);
        x1 = Math.max(x1, s.run.x + s.run.w * b);
        y0 = Math.min(y0, s.run.y);
        y1 = Math.max(y1, s.run.y + s.run.h);
      }
      return { kind: "box", page: p, x: x0, y: y0, w: x1 - x0, h: y1 - y0, quote: q };
    }
  }

  return { kind: "quote", quote: q };
}
