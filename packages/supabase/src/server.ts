import { createServerClient as createSSRClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

/**
 * Read-write Supabase client bound to the current request's cookies (RSC + Server Actions).
 *
 * Returns the canonical `SupabaseClient<Database>` so typed `.from()` queries
 * infer real rows. (@supabase/ssr@0.5 infers a client whose schema generic is
 * shaped for an older supabase-js; the cast bridges that — runtime is identical
 * and the versions are peer-compatible.)
 */
export function createServerClient(cookies: {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: CookieOptions) => void;
}): SupabaseClient<Database> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    process.env.NEXT_PUBLIC_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new Error("Neither NEXT_PUBLIC_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set");
  }

  return createSSRClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (toSet: { name: string; value: string; options?: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of toSet) {
            cookies.set(name, value, options);
          }
        } catch {
          // RSCs can't set cookies; that's fine — middleware handles refresh.
        }
      },
    },
  }) as unknown as SupabaseClient<Database>;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
}
