import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

let cached: SupabaseClient<Database> | null = null;

/**
 * Admin client using the Supabase secret (formerly service_role) key.
 * BYPASSES Row Level Security.
 * Use only on the server, never expose the key to the browser.
 * Use cases: Inngest jobs, webhooks, scripts.
 */
export function createServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;
  // `||`, NOT `??`. `.env` files ship unused vars as `FOO=""`, and `??` only
  // falls back on null/undefined — so an empty SUPABASE_URL would *win* the
  // fallback and then fail the check below, taking down every service-role
  // path (audit, webhooks, Inngest jobs, worker milk logging).
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set");

  cached = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
