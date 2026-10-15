import { NextResponse } from "next/server";
import { UserError } from "@/lib/errors";

export function jsonError(e: unknown) {
  if (e instanceof UserError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "no_workspace" ? 401 : 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
