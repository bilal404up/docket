import { NextResponse } from "next/server";
import { UUID } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Opens an uploaded original through a signed link that lasts one minute. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return new NextResponse("Not found", { status: 404 });
  const sb = createClient();
  const { data: doc } = await sb.from("documents").select("file_path,sample_key").eq("id", params.id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  if (doc.sample_key) return NextResponse.redirect(new URL(`/api/samples/${doc.sample_key}`, req.url));
  if (!doc.file_path) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await sb.storage.from("uploads").createSignedUrl(doc.file_path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
