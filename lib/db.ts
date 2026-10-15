import { UserError } from "@/lib/errors";

/** Supabase returns a related row as an object or a one-item array depending on the relationship. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function errorMessage(e: unknown, fallback = "Something went wrong. Try again.") {
  return e instanceof UserError ? e.message : fallback;
}
