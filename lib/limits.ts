/** Limits for a public demo. Vercel caps request bodies at 4.5 MB, so files stop at 4 MB. */
export const LIMITS = {
  fileBytes: 4 * 1024 * 1024,
  pages: 5,
  docsPerSandbox: 30,
  textChars: 20_000,
  livePerSandbox: 5,
  liveSiteWide: 100,
} as const;
