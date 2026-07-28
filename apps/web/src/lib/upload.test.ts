import { beforeEach, describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, UploadError, validateUpload } from "./upload";

/**
 * Upload contract (Feature D). Pure + offline — no Supabase, no network.
 * The rate limiter is module-level in-memory state, so each test uses a fresh
 * user id to avoid bleeding counts between cases.
 */

let seq = 0;
const freshUser = () => `user-${seq++}`;

function file(name: string, type: string, bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateUpload", () => {
  let user: string;
  beforeEach(() => {
    user = freshUser();
  });

  it("accepts an ordinary phone JPEG", () => {
    const f = file("milk-sheet.jpg", "image/jpeg");
    expect(validateUpload(f, user)).toBe(f);
  });

  it("rejects a missing file", () => {
    expect(() => validateUpload(null, user)).toThrow(UploadError);
    expect(() => validateUpload(undefined, user)).toThrowError(/no image/i);
  });

  it("rejects an empty file", () => {
    expect(() => validateUpload(file("x.jpg", "image/jpeg", 0), user)).toThrowError(/no image/i);
  });

  it("rejects a PDF — the vision path only reads photos", () => {
    try {
      validateUpload(file("statement.pdf", "application/pdf"), user);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      expect((err as UploadError).code).toBe("bad_type");
    }
  });

  it("rejects a file over the size cap", () => {
    try {
      validateUpload(file("huge.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1), user);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as UploadError).code).toBe("too_large");
    }
  });

  it("accepts a file exactly at the cap", () => {
    expect(() => validateUpload(file("edge.jpg", "image/jpeg", MAX_UPLOAD_BYTES), user)).not.toThrow();
  });

  it("accepts HEIC by extension when the browser sends no MIME type", () => {
    // iOS camera captures routinely arrive with an empty `type`.
    expect(() => validateUpload(file("IMG_0042.HEIC", "", 2048), user)).not.toThrow();
  });

  it("accepts by MIME when the filename has no extension", () => {
    expect(() => validateUpload(file("capture", "image/png", 2048), user)).not.toThrow();
  });

  it("rate-limits a burst of scans from one user", () => {
    for (let i = 0; i < 12; i++) {
      expect(() => validateUpload(file(`s${i}.jpg`, "image/jpeg"), user)).not.toThrow();
    }
    try {
      validateUpload(file("13th.jpg", "image/jpeg"), user);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as UploadError).code).toBe("rate_limited");
    }
  });

  it("rate-limits per user, not globally", () => {
    const a = freshUser();
    for (let i = 0; i < 12; i++) validateUpload(file(`a${i}.jpg`, "image/jpeg"), a);
    // A different worker on a different phone must be unaffected.
    expect(() => validateUpload(file("b.jpg", "image/jpeg"), freshUser())).not.toThrow();
  });
});
