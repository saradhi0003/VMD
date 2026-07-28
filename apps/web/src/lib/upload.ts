import { AuthzError, rateLimit } from "./guard";

/**
 * Upload contract, ported from FinTracker's `/statements` route.
 *
 * FinTracker's domain was bank statements (.pdf/.csv/.xlsx); VMD's is phone
 * photos of milk sheets and receipts. The *shape* of the guard is what ports:
 * allow-list the extension, cap the size, rate-limit the caller, and store under
 * a path keyed to the owner so storage RLS can enforce isolation.
 *
 * The per-farm storage path + `is_approved()` half lives in migration 0005.
 */

/** Extensions the Smart Scan vision path can actually read. */
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * 10 MB. Phone cameras routinely produce 3–6 MB, so the cap has to clear that
 * comfortably. Keep `next.config.ts` → `serverActions.bodySizeLimit` ABOVE this
 * number, otherwise Next rejects the request with a raw 413 before this code
 * runs and the user sees a crash instead of a readable message.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UploadError extends Error {
  constructor(
    message: string,
    /** Short slug for the `?error=` query param on the redirect. */
    readonly code: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** User-facing copy for every `?error=` code the scan actions can redirect with. */
export const SCAN_ERROR_MESSAGES: Record<string, string> = {
  no_image: "Please choose a photo first.",
  too_large: "That photo is too big — the limit is 10 MB. Try again at a lower resolution.",
  bad_type: "Only photos are supported (JPG, PNG, WEBP or HEIC).",
  rate_limited: "Too many scans in a row — wait a minute and try again.",
  scan_failed: "Could not read that image — try a clearer photo.",
};

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/**
 * Validate an uploaded image and rate-limit the uploader.
 * Throws `UploadError` with a `code` suitable for a redirect query param.
 */
export function validateUpload(file: unknown, userId: string): File {
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadError("No image was attached.", "no_image");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new UploadError(`That photo is ${mb} MB — the limit is 10 MB.`, "too_large");
  }

  // Check both, and require only one to pass: some Android browsers send an
  // empty or generic `type` for camera captures, and iOS sends HEIC with an
  // extension the MIME table doesn't always agree on.
  const ext = extensionOf(file.name);
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const mimeOk = ALLOWED_MIME.has(file.type);
  if (!extOk && !mimeOk) {
    throw new UploadError(
      `Only photos are supported (${ALLOWED_EXTENSIONS.join(", ")}).`,
      "bad_type",
    );
  }

  // Vision calls are the most expensive thing a user can trigger. Blunt a stuck
  // retry loop before it costs a minute of GPU per press.
  try {
    rateLimit(`scan:${userId}`, 12, 60_000);
  } catch (err) {
    if (err instanceof AuthzError) {
      throw new UploadError("Too many scans — wait a minute and try again.", "rate_limited");
    }
    throw err;
  }

  return file;
}
