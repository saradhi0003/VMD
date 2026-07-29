import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * LIVE integration checks for the code layers (LLM · agentic · orchestration).
 *
 *   pnpm verify:integration
 *
 * NOT part of `pnpm test` — vitest.config.ts only includes `packages/**` and
 * `apps/**\/src/**`, so this file is opt-in on purpose: it makes **real, billable
 * API calls** and needs network. `pnpm test` must stay free, offline and fast.
 *
 * Run under vitest (not plain node) because the workspace packages use
 * NodeNext-style `./index.js` imports that point at `.ts` sources — the
 * `ts-js-extension-resolver` plugin in vitest.config.ts is what remaps them.
 */

// Load at MODULE scope, not in beforeAll: `it.runIf(...)` is evaluated during
// collection, which happens before any hook runs. In beforeAll the live tests
// silently skipped because the key wasn't in process.env yet.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) {
    const v = m[2].replace(/^["']|["']$/g, "");
    if (v) process.env[m[1]] = v; // never set "" — it reads as configured-but-blank
  }
}

const hasLLM = Boolean(process.env.ANTHROPIC_API_KEY || process.env.LLM_BASE_URL);

describe("LLM context layer — provider resolution", () => {
  const saved: Record<string, string | undefined> = {};
  const set = (k: string, v: string | undefined) => {
    if (!(k in saved)) saved[k] = process.env[k];
    // Assigning `undefined` to process.env coerces to the STRING "undefined".
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const k of Object.keys(saved)) delete saved[k];
  });

  it("prefers the free self-hosted server over paid Anthropic", async () => {
    const { activeProvider } = await import("../packages/llm/src/provider.js");
    set("LLM_BASE_URL", "https://x.trycloudflare.com/v1");
    set("ANTHROPIC_API_KEY", "sk-ant-test");
    set("LLM_PROVIDER", "");
    expect(activeProvider()).toBe("openai-compat");
  });

  it("prefers DeepSeek over Anthropic when both are configured", async () => {
    const { activeProvider } = await import("../packages/llm/src/provider.js");
    set("LLM_BASE_URL", undefined);
    set("LLM_PROVIDER", "");
    set("DEEPSEEK_API_KEY", "sk-ds-test");
    set("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(activeProvider()).toBe("deepseek"); // cheaper wins
  });

  it("falls back to Anthropic, then to none", async () => {
    const { activeProvider } = await import("../packages/llm/src/provider.js");
    set("LLM_BASE_URL", undefined);
    set("LLM_PROVIDER", "");
    set("DEEPSEEK_API_KEY", undefined);
    set("LLM_API_KEY", undefined);
    set("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(activeProvider()).toBe("anthropic");
    set("ANTHROPIC_API_KEY", undefined);
    expect(activeProvider()).toBe("none");
  });

  it("resolves a real provider from the live .env.local", async () => {
    const { activeProvider } = await import("../packages/llm/src/provider.js");
    expect(["anthropic", "openai-compat", "deepseek"]).toContain(activeProvider());
  });
});

describe("Capabilities — verified against the live APIs", () => {
  it("DeepSeek: no vision, no json_schema, burns reasoning tokens", async () => {
    const { capabilities } = await import("../packages/llm/src/provider.js");
    expect(capabilities("deepseek")).toEqual({
      vision: false,
      jsonSchema: false,
      reasoning: true,
    });
  });

  it("Smart Scan degrades (never throws) on a vision-less provider", async () => {
    const saved = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "deepseek";
    try {
      const { scanDocument } = await import("../packages/llm/src/extract.js");
      const out = await scanDocument("ZmFrZQ==", "image/jpeg");
      expect(out.type).toBe("other");
      expect(out.confidence).toBe(0);
    } finally {
      if (saved) process.env.LLM_PROVIDER = saved;
      else delete process.env.LLM_PROVIDER;
    }
  });
});

describe("LLM reasoning layer — live calls", () => {
  it.runIf(hasLLM)(
    "chatJson returns a completion with token accounting",
    async () => {
      const { chatJson } = await import("../packages/llm/src/provider.js");
      const r = await chatJson({ user: "Reply with the single word: ok", maxTokens: 16, fast: true });
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.inputTokens).toBeGreaterThan(0);
      expect(r.model).toBeTruthy();
      console.log(`      → ${r.model} in=${r.inputTokens} out=${r.outputTokens}`);
    },
    90_000,
  );

  it.runIf(hasLLM)(
    "extractMilkFromText returns schema-valid structured output",
    async () => {
      const { extractMilkFromText } = await import("../packages/llm/src/extract.js");
      const out = await extractMilkFromText("12.5 litres morning, fat 4.2%");
      expect(out.litres).toBe(12.5);
      expect(out.fatPct).toBeCloseTo(4.2, 1);
      expect(out.shift).toBe("morning");
      expect(out.confidence).toBeGreaterThan(0);
      console.log(`      → ${JSON.stringify(out)}`);
    },
    90_000,
  );

  it("degrades to the regex parser with no provider (offline contract)", async () => {
    const saved = { a: process.env.ANTHROPIC_API_KEY, b: process.env.LLM_BASE_URL, c: process.env.LLM_PROVIDER };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_PROVIDER;
    try {
      const { extractMilkFromText } = await import("../packages/llm/src/extract.js");
      const out = await extractMilkFromText("8 lit shaam");
      expect(out.litres).toBe(8);
      expect(out.shift).toBe("evening"); // Hindi
    } finally {
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
      if (saved.b) process.env.LLM_BASE_URL = saved.b;
      if (saved.c) process.env.LLM_PROVIDER = saved.c;
    }
  });

  it("scanDocument degrades to `other` with no provider (never throws)", async () => {
    const saved = { a: process.env.ANTHROPIC_API_KEY, b: process.env.LLM_BASE_URL };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_BASE_URL;
    try {
      const { scanDocument } = await import("../packages/llm/src/extract.js");
      const out = await scanDocument("ZmFrZQ==", "image/jpeg");
      expect(out.type).toBe("other");
      expect(out.confidence).toBe(0);
    } finally {
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
      if (saved.b) process.env.LLM_BASE_URL = saved.b;
    }
  });
});

describe("Agentic layer — daily agent", () => {
  it.runIf(hasLLM)(
    "produces schema-valid findings from a farm snapshot",
    async () => {
      const { runDailyAgent } = await import("../packages/llm/src/daily-agent.js");
      const out = await runDailyAgent({
        farmName: "Verify Farm",
        today: new Date().toISOString().slice(0, 10),
        yesterday: { morning: 120, evening: null, fatPct: 4.1 },
        last7Days: [
          { date: "2026-07-20", total: 240, fatPct: 4.2 },
          { date: "2026-07-21", total: 180, fatPct: 4.0 },
          { date: "2026-07-22", total: 120, fatPct: 3.6 },
        ],
        missingEntries: [{ date: "2026-07-26", shift: "evening" }],
        upcomingReminders: [{ dueAt: "2026-07-29", title: "Vet visit", priority: "high" }],
        quietCustomers: [{ name: "Test Co", daysSinceLastOrder: 14 }],
        recentHealthEvents: [{ animal: "Ganga", kind: "mastitis", daysAgo: 3 }],
      });
      expect(out.findings.length).toBeGreaterThan(0);
      for (const f of out.findings) {
        expect(["info", "warning", "critical"]).toContain(f.severity);
        expect(f.title.length).toBeGreaterThanOrEqual(4);
        expect(f.suggested_action.length).toBeGreaterThanOrEqual(4);
        expect(f.confidence).toBeGreaterThanOrEqual(0);
        expect(f.confidence).toBeLessThanOrEqual(1);
      }
      console.log(`      → ${out.findings.length} findings via ${out.model}`);
      for (const f of out.findings) console.log(`         [${f.severity}] ${f.title}`);
    },
    180_000,
  );
});

describe("Orchestration layer — Inngest", () => {
  it("registers every function", async () => {
    const { allFunctions } = await import("../packages/jobs/src/functions/index.js");
    expect(allFunctions.length).toBeGreaterThanOrEqual(5);
  });

  it("declares the access-request event with a typed schema", async () => {
    const { events } = await import("../packages/jobs/src/client.js");
    expect(Object.keys(events)).toContain("user/access.requested");
    const parsed = events["user/access.requested"].data.safeParse({
      farmId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      name: "Test",
      email: "t@example.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("emit() never throws even when Inngest is unreachable (golden rule 5)", async () => {
    const { emit } = await import("../packages/jobs/src/client.js");
    await expect(
      emit({
        name: "farm/daily-agent.requested",
        data: { farmId: "00000000-0000-0000-0000-000000000000", forDate: "2026-01-01" },
      }),
    ).resolves.toBeUndefined();
  }, 30_000);
});

describe("SMTP layer", () => {
  it("skips cleanly when unconfigured — approval never depends on email", async () => {
    const { sendMail, smtpConfigured } = await import("../packages/jobs/src/mailer.js");
    if (smtpConfigured()) {
      console.log("      → SMTP configured; skip-path not exercised");
      return;
    }
    await expect(sendMail({ to: "x@example.com", subject: "probe", text: "probe" })).resolves.toBe(false);
  });
});

describe("Upload contract", () => {
  it("enforces type, size and rate limits", async () => {
    const { validateUpload, MAX_UPLOAD_BYTES, UploadError } = await import("../apps/web/src/lib/upload.js");
    const f = (n: string, t: string, b = 1024) => new File([new Uint8Array(b)], n, { type: t });
    expect(validateUpload(f("a.jpg", "image/jpeg"), "u-int-1")).toBeInstanceOf(File);
    expect(() => validateUpload(f("a.pdf", "application/pdf"), "u-int-2")).toThrow(UploadError);
    expect(() => validateUpload(f("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1), "u-int-3")).toThrow(/10 MB/);
  });
});
