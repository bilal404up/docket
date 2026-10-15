/** An error whose message is safe and useful to show the visitor. */
export class UserError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "UserError";
  }
}

/** Awaits a Supabase query and throws if it failed. */
export async function must<T extends { error: { message: string } | null }>(query: PromiseLike<T>): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result;
}
