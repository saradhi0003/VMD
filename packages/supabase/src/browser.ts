import { createBrowserClient as createBrowserSSRClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

let cached: SupabaseClient<Database> | null = null;

/** Singleton browser-side Supabase client (see server.ts for the cast rationale). */
export function createBrowserClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase browser client: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_PUBLISHABLE_KEY required");
  }
  cached = createBrowserSSRClient<Database>(url, key) as unknown as SupabaseClient<Database>;
  return cached;
}
