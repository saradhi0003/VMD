import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Opt-in LIVE integration suite — `pnpm verify:integration`.
 *
 * Deliberately a separate config from vitest.config.ts so the default
 * `pnpm test` can never pick these up: they make **real, billable API calls**
 * and require network. Keep `pnpm test` free, offline and fast.
 *
 * Same `.js`→`.ts` resolver as the main config, because the workspace packages
 * use NodeNext-style imports pointing at TypeScript sources.
 */
const tsExtensionResolver = {
  name: "ts-js-extension-resolver",
  resolveId(source: string, importer?: string) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const candidate = path.resolve(path.dirname(importer), source.replace(/\.js$/, ".ts"));
    return fs.existsSync(candidate) ? candidate : null;
  },
};

export default defineConfig({
  plugins: [tsExtensionResolver],
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // Live calls against one Anthropic key — don't hammer it in parallel.
    fileParallelism: false,
  },
});
