import { expect, test } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";

/**
 * Page-load performance budgets via Lighthouse, driven through the same Chrome
 * Playwright launches (port 9222, set in the "perf" project's launchOptions).
 *
 * NOTE: run against a production build (`pnpm build && pnpm start`) for realistic
 * numbers — `next dev` ships unminified code and will score far lower. Thresholds
 * below are intentionally lenient for dev; raise them once running against prod.
 */
const thresholds = {
  performance: 50,
  accessibility: 85,
  "best-practices": 80,
  seo: 80,
};

const lhOpts = {
  port: 9222,
  thresholds,
  opts: { onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
};

test.describe("page-load performance (public)", () => {
  test("marketing home meets budget", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await playAudit({ page, ...lhOpts });
  });
});

test.describe("page-load performance (worker, authed)", () => {
  test.use({ storageState: "tests/.auth/worker.json" });

  test("worker shed home meets budget", async ({ page }) => {
    await page.goto("/worker");
    await playAudit({ page, ...lhOpts });
  });
});
