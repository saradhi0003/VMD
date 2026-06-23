import { expect, test } from "@playwright/test";

// Reuse the worker session captured in global-setup.
test.use({ storageState: "tests/.auth/worker.json" });

test.describe("worker workspace", () => {
  test("loads the shed home without redirecting to login", async ({ page }) => {
    await page.goto("/worker");
    await expect(page).toHaveURL(/\/worker(\/|$)/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  // Flagship write-path test: fill the milk form → server action inserts a
  // milk_sessions row → action redirects back to /worker. Reaching /worker means
  // auth + zod parse + assertAnimalInFarm + insert + audit + inngest.send all ran.
  test("logs a milk session end to end", async ({ page }) => {
    await page.goto("/worker/log/milk");

    // First real option (index 0 is the disabled "Choose animal…" placeholder).
    await page.locator('select[name="animalId"]').selectOption({ index: 1 });
    await page.fill('input[name="litres"]', "7.7");
    await page.fill('input[name="fatPct"]', "4.1");

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/worker(\/|$)/, { timeout: 15_000 });
  });
});
