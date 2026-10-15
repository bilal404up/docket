import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocumentProxy } from "unpdf";
import { UserError } from "@/lib/errors";
import type { Sample } from "@/lib/samples";
import type { Page, Run, TextLayer } from "@/lib/types";

const SAMPLE_MARK = "docket-sample:";

/**
  Builds a sample's PDF from its layout. The sample key is written into the PDF's
  Subject, so when a visitor downloads a sample and uploads it back, Docket
  recognizes it and can use the saved reading instead of a paid model.
*/
export async function buildSamplePdf(sample: Sample): Promise<Uint8Array> {
  if (sample.layer.kind !== "pages") throw new Error(`${sample.key} is not a PDF sample`);
  const doc = await PDFDocument.create();
  const fixed = new Date("2026-01-01T00:00:00Z");
  doc.setTitle(sample.title);
  doc.setSubject(`${SAMPLE_MARK}${sample.key}`);
  doc.setAuthor("Docket demo, invented data");
  doc.setProducer("Docket demo");
  doc.setCreator("Docket demo");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const spec of sample.layer.pages) {
    const W = spec.width;
    const H = spec.height;
    const page = doc.addPage([W, H]);
    for (const r of spec.rules ?? []) {
      page.drawLine({
        start: { x: r.x1 * W, y: H - r.y1 * H },
        end: { x: r.x2 * W, y: H - r.y2 * H },
        thickness: 0.75,
        color: rgb(0.17, 0.18, 0.2),
      });
    }
    for (const run of spec.runs) {
      const size = run.s ?? 10;
      page.drawText(run.t, {
        x: run.x * W,
        y: H - (run.y * H + size * 0.95),
        size,
        font: run.b ? bold : regular,
        color: rgb(0.08, 0.08, 0.1),
      });
    }
  }
  return doc.save();
}

/** Page count, and the sample key if this is a downloaded Docket sample. */
export async function inspectPdf(bytes: Uint8Array): Promise<{ pages: number; sampleKey: string | null }> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const subject = doc.getSubject() ?? "";
    return {
      pages: doc.getPageCount(),
      sampleKey: subject.startsWith(SAMPLE_MARK) ? subject.slice(SAMPLE_MARK.length) : null,
    };
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(e.message)) {
      throw new UserError("encrypted", "This PDF is password-protected, so it can't be read. Remove the password and try again.");
    }
    throw new UserError("bad_pdf", "This file doesn't look like a valid PDF.");
  }
}

type TextItem = { str?: string; transform?: number[]; width?: number; height?: number };

/** Reads the text layer of an uploaded PDF: each run of text with its position, scaled 0 to 1. */
export async function extractLayer(bytes: Uint8Array): Promise<TextLayer> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: Page[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { width: W, height: H } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const runs: Run[] = [];
    for (const item of content.items as TextItem[]) {
      if (!item.str || !item.str.trim() || !item.transform) continue;
      const [, , c, d, e, f] = item.transform;
      const size = Math.hypot(c, d) || item.height || 10;
      runs.push({
        t: item.str,
        x: e / W,
        y: (H - f - size * 0.95) / H,
        w: (item.width ?? 0) / W,
        h: (size * 1.25) / H,
        s: size,
      });
    }
    pages.push({ width: W, height: H, runs });
  }
  return { kind: "pages", pages };
}
