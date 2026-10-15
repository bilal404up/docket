import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { UUID } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rereadDocument } from "@/lib/pipeline/run";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sb = createClient();
    const ws = await requireWorkspace(sb);
    const result = await rereadDocument(sb, ws, params.id);
    revalidatePath("/app", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
