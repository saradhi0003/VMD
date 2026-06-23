import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

const AUTH_DIR = path.join(process.cwd(), "tests", ".auth");

/**
 * Log in once as owner and as worker, save each session's storage state.
 * Specs then `test.use({ storageState })` instead of logging in every test.
 * Credentials default to the demo logins (CLAUDE.md); override via env.
 */
async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();

  // Owner: email + password (the password form's button is the only exact "Sign in").
  const owner = await browser.newContext({ baseURL });
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/owner/login");
  await ownerPage.fill('input[name="email"]', process.env.E2E_OWNER_EMAIL ?? "admin@vayumukhi.in");
  await ownerPage.fill('input[name="password"]', process.env.E2E_OWNER_PASSWORD ?? "farm123");
  await ownerPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await ownerPage.waitForURL("**/owner", { timeout: 15_000 });
  await owner.storageState({ path: path.join(AUTH_DIR, "owner.json") });

  // Worker: name + PIN.
  const worker = await browser.newContext({ baseURL });
  const workerPage = await worker.newPage();
  await workerPage.goto("/worker/login");
  await workerPage.fill('input[name="name"]', process.env.E2E_WORKER_NAME ?? "Suresh");
  await workerPage.fill('input[name="pin"]', process.env.E2E_WORKER_PIN ?? "123456");
  await workerPage.getByRole("button", { name: "Sign in" }).click();
  await workerPage.waitForURL("**/worker", { timeout: 15_000 });
  await worker.storageState({ path: path.join(AUTH_DIR, "worker.json") });

  await browser.close();
}

export default globalSetup;
