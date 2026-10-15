import path from "node:path";
import { defineConfig } from "vitest/config";

/* `npm test` runs everything that needs no network. `npm run test:rls` runs the
   row-level security test against your Supabase project. */
const rls = process.env.npm_lifecycle_event === "test:rls";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
  test: {
    include: rls ? ["tests/rls.test.ts"] : ["tests/**/*.test.ts"],
    exclude: rls ? ["node_modules/**"] : ["node_modules/**", "tests/rls.test.ts"],
    testTimeout: rls ? 30_000 : 5_000,
  },
});
