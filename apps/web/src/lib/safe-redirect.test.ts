import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

/**
 * Open-redirect / phishing guard.
 *
 * These payloads all escaped `new URL(next, base)` before the fix — the base
 * URL is ignored whenever `next` is absolute or protocol-relative, so a link on
 * the real domain could bounce a just-authenticated user to a look-alike site.
 */
describe("safeNextPath", () => {
  it("keeps ordinary same-site paths", () => {
    expect(safeNextPath("/owner")).toBe("/owner");
    expect(safeNextPath("/worker/log/milk")).toBe("/worker/log/milk");
    expect(safeNextPath("/owner/scan/review?scanId=abc")).toBe("/owner/scan/review?scanId=abc");
  });

  it("falls back for empty input", () => {
    expect(safeNextPath(null)).toBe("/owner");
    expect(safeNextPath(undefined)).toBe("/owner");
    expect(safeNextPath("")).toBe("/owner");
    expect(safeNextPath(null, "/")).toBe("/");
  });

  it.each([
    ["absolute https", "https://evil.example.com/steal"],
    ["absolute http", "http://evil.example.com"],
    ["protocol-relative", "//evil.example.com"],
    ["scheme without slashes", "https:evil.example.com"],
    ["backslash trick", "/\\evil.example.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["bare host", "evil.example.com"],
    ["newline smuggling", "/owner\nLocation: https://evil.example.com"],
  ])("rejects %s", (_label, payload) => {
    expect(safeNextPath(payload)).toBe("/owner");
  });

  it("the rejected values would otherwise escape via new URL()", () => {
    // Documents *why* this guard exists, and fails loudly if the platform
    // behaviour ever changes.
    const base = "https://app.example.com/api/auth/callback";
    expect(new URL("https://evil.example.com", base).origin).toBe("https://evil.example.com");
    expect(new URL("//evil.example.com", base).origin).toBe("https://evil.example.com");
    // …whereas the sanitised value stays on our origin.
    expect(new URL(safeNextPath("https://evil.example.com"), base).origin).toBe("https://app.example.com");
  });
});
