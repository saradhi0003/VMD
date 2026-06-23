import { expect, test } from "@playwright/test";

// API-route checks via Playwright's request fixture (no browser/session needed).
test.describe("API routes", () => {
  test("GET /api/health reports ok when the DB is reachable", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  test("WhatsApp webhook verification rejects a wrong verify_token", async ({ request }) => {
    const res = await request.get(
      "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123",
    );
    expect(res.status()).toBe(403);
  });

  test("WhatsApp webhook POST is a safe no-op for empty payloads", async ({ request }) => {
    const res = await request.post("/api/webhooks/whatsapp", { data: { entry: [] } });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
