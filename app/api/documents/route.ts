import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { UserError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { LIMITS } from "@/lib/limits";
import { ingest, type IngestInput } from "@/lib/pipeline/run";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Adds a document: a file (multipart), a sample ({ sampleKey }) or pasted text ({ text }). */
export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const ws = await requireWorkspace(sb);
    let input: IngestInput;

    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new UserError("no_file", "Choose a file to upload.");
      if (file.size > LIMITS.fileBytes) throw new UserError("too_big", "That file is over 4 MB. Try a smaller one.");
      input = { kind: "file", name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
    } else {
      const body = await req.json().catch(() => null);
      if (typeof body?.sampleKey === "string") input = { kind: "sample", sampleKey: body.sampleKey };
      else if (typeof body?.text === "string") input = { kind: "text", text: body.text };
      else throw new UserError("bad_request", "Send a file, a sample or some text.");
    }

    const result = await ingest(sb, ws, input);
    revalidatePath("/app", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
