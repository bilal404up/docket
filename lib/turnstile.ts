export const turnstileOn = () =>
  Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/** Checks a Cloudflare Turnstile token. Always passes when Turnstile isn't configured. */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  if (!turnstileOn()) return true;
  if (!token) return false;
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  if (ip) form.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).catch(() => null);
  const json = await res?.json().catch(() => null);
  return Boolean(json?.success);
}
