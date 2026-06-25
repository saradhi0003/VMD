import { createBrowserClient as createBrowserSSRClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

let cached: SupabaseClient<Database> | null = null;

/**
 * Singleton browser-side Supabase client (see server.ts for the cast rationale).
 * Returns `null` instead of throwing when the public env isn't present, so a
 * misconfigured deploy degrades (no realtime/MFA) rather than crashing the page.
 * Callers must handle `null`.
 */
export function createBrowserClient(): SupabaseClient<Database> | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (typeof console !== "undefined") {
      console.error("[supabase] browser client unavailable — NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_PUBLISHABLE_KEY missing in the client bundle");
    }
    return null;
  }
  cached = createBrowserSSRClient<Database>(url, key) as unknown as SupabaseClient<Database>;
  return cached;
}
