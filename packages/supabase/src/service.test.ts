import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the `??` vs `||` env bug.
 *
 * `.env.example` ships every optional var as `FOO=""`, so real `.env.local`
 * files carry empty strings. `??` only falls back on null/undefined, so
 * `process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL` resolved
 * to `""` and then threw "SUPABASE_URL is not set" — taking down every
 * service-role path: recordAudit, the WhatsApp webhook, Inngest jobs, and the
 * worker milk-log server action. Caught by the E2E suite, not by typecheck.
 */

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string) => ({ __url: url, __key: key }),
}));

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const saved: Record<string, string | undefined> = {};
function setEnv(patch: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) if (!(k in saved)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(patch)) {
    // Assigning undefined to process.env coerces to the string "undefined".
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
});

/** Fresh module each time — the client is cached in module scope. */
async function freshClient() {
  vi.resetModules();
  const mod = await import("./service.js");
  return mod.createServiceClient() as unknown as { __url: string; __key: string };
}

describe("createServiceClient env resolution", () => {
  it("falls through an EMPTY SUPABASE_URL to the public alias", async () => {
    setEnv({
      SUPABASE_URL: "", // ← the exact shape that broke production
      NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_x",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });
    const c = await freshClient();
    expect(c.__url).toBe("https://proj.supabase.co");
  });

  it("falls through an EMPTY secret key to the legacy service_role name", async () => {
    setEnv({
      SUPABASE_URL: "https://proj.supabase.co",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "legacy_role_key",
    });
    const c = await freshClient();
    expect(c.__key).toBe("legacy_role_key");
  });

  it("prefers an explicitly set SUPABASE_URL over the public one", async () => {
    setEnv({
      SUPABASE_URL: "https://explicit.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_x",
    });
    const c = await freshClient();
    expect(c.__url).toBe("https://explicit.supabase.co");
  });

  it("still throws when BOTH url names are empty", async () => {
    setEnv({
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: "sb_secret_x",
    });
    await expect(freshClient()).rejects.toThrow(/SUPABASE_URL/);
  });

  it("still throws when both key names are empty", async () => {
    setEnv({
      SUPABASE_URL: "https://proj.supabase.co",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });
    await expect(freshClient()).rejects.toThrow(/SUPABASE_SECRET_KEY/);
  });
});
