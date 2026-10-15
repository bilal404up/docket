import { NextResponse } from "next/server";
import { buildSamplePdf } from "@/lib/pdf";
import { sampleByKey } from "@/lib/samples";

export const runtime = "nodejs";

/** Serves a sample document. Add ?download=1 to save it, then upload it back to see the real upload path. */
export async function GET(req: Request, { params }: { params: { key: string } }) {
  const sample = sampleByKey(params.key);
  if (!sample) return new NextResponse("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const disposition = (name: string) => `${download ? "attachment" : "inline"}; filename="${name}"`;

  if (sample.source === "pdf") {
    const bytes = await buildSamplePdf(sample);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": disposition(`${sample.key}.pdf`),
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (sample.body) {
    const csv = sample.source === "csv";
    return new NextResponse(sample.body, {
      headers: {
        "content-type": `${csv ? "text/csv" : "text/plain"}; charset=utf-8`,
        "content-disposition": disposition(`${sample.key}.${csv ? "csv" : "txt"}`),
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (sample.asset) return NextResponse.redirect(new URL(sample.asset, req.url));
  return new NextResponse("Not found", { status: 404 });
}
