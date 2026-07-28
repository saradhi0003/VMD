/**
 * Next.js boot hook — runs once per server instance, before any request.
 *
 * Its only job is to pull in `lib/env.ts`, whose module body validates
 * `process.env` and throws on a bad config. Without this the schema was dead
 * code: it existed, was correct, and was never imported by anything.
 *
 * Node runtime only. Middleware boots the edge runtime too, where a hard throw
 * would take down routing over a var that edge code never reads.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}
