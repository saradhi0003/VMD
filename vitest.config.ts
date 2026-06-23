import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * The packages use NodeNext-style imports (`./index.js` pointing at `index.ts`).
 * Vite's resolver doesn't remap `.js`→`.ts` on its own, so do it here for tests.
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
    include: ["packages/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    // E2E / perf specs are driven by Playwright, not Vitest.
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/tests/perf/**", "**/.next/**"],
  },
});
