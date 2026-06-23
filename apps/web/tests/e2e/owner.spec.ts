import { expect, test } from "@playwright/test";

// Reuse the owner session captured in global-setup.
test.use({ storageState: "tests/.auth/owner.json" });

test.describe("owner workspace", () => {
  test("loads the dashboard without redirecting to login", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/owner");

    await expect(page).toHaveURL(/\/owner(\/|$)/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(errors, `console errors:\n${errors.join("\n")}`).toHaveLength(0);
  });

  test("can reach the production page", async ({ page }) => {
    await page.goto("/owner/production");
    await expect(page).toHaveURL(/\/owner\/production/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
