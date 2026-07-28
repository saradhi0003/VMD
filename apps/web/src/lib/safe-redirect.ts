/**
 * Open-redirect guard.
 *
 * `new URL(next, base)` does NOT confine `next` to `base` — an absolute or
 * protocol-relative value wins outright:
 *
 *   new URL("https://evil.com",  "https://app.com/cb") → https://evil.com/
 *   new URL("//evil.com",        "https://app.com/cb") → http://evil.com/
 *   new URL("https:evil.com",    "https://app.com/cb") → https://evil.com/
 *
 * That turns any `?next=` parameter into a phishing primitive: the victim sees
 * a link on the real domain, and gets bounced to a look-alike *after* the
 * session cookie is set, which is exactly when they trust the page most.
 *
 * Rule: only ever redirect to a path on our own origin. Anything else falls
 * back to a safe default.
 */

const DEFAULT_PATH = "/owner";

/**
 * Normalise a caller-supplied `next` into a same-origin **path**.
 * Returns `fallback` for anything absolute, protocol-relative, or malformed.
 */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_PATH): string {
  if (!next) return fallback;

  // Must start with exactly one "/" — rejects "//evil.com" and "https://evil.com".
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;

  // Reject "/\evil.com" — some browsers normalise backslashes to forward slashes.
  if (next.startsWith("/\\")) return fallback;

  // A scheme anywhere before the first slash (e.g. "https:evil.com") is absolute.
  if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return fallback;

  // Control characters / newlines can be used to smuggle headers.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;

  return next;
}
