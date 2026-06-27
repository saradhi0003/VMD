import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractMilkFromText, scanDocument } from "./extract.js";

/**
 * Without ANTHROPIC_API_KEY, extractMilkFromText falls back to a deterministic
 * regex parser — so these run offline, free, and fast (no real LLM call).
 */
describe("extractMilkFromText (offline regex fallback)", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });

  it("pulls litres + fat% + morning shift from an English entry", async () => {
    const out = await extractMilkFromText("12.5 litres morning, fat 4.2%");
    expect(out.litres).toBe(12.5);
    expect(out.fatPct).toBe(4.2);
    expect(out.shift).toBe("morning");
    expect(out.confidence).toBeGreaterThan(0.5);
  });

  it("understands Hindi shift words (shaam = evening)", async () => {
    const out = await extractMilkFromText("8 lit shaam");
    expect(out.litres).toBe(8);
    expect(out.shift).toBe("evening");
  });

  it("returns low confidence and null shift when nothing parses", async () => {
    const out = await extractMilkFromText("hello there");
    expect(out.shift).toBeNull();
    expect(out.confidence).toBeLessThan(0.5);
  });

  it("always echoes the raw transcript back", async () => {
    const out = await extractMilkFromText("9.0 L");
    expect(out.rawText).toBe("9.0 L");
  });
});

/**
 * Multi-document Smart Scan. With no API key, scanDocument must degrade to an
 * empty `other` result (best-effort contract — a scan must never throw / block
 * the worker). Real classification accuracy is exercised via the live LLM, not here.
 */
describe("scanDocument (offline degradation)", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });

  it("returns an empty 'other' result without an API key", async () => {
    const out = await scanDocument("ZmFrZQ==", "image/jpeg");
    expect(out.type).toBe("other");
    expect(out.confidence).toBe(0);
    if (out.type === "other") expect(out.title).toBeNull();
  });
});
