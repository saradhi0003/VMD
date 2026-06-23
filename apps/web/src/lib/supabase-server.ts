import { createServerClient as createBase } from "@vmd/supabase";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client.
 * Reads the session cookie, refreshes it through middleware on the way out.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createBase({
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    set: (name, value, options) => cookieStore.set({ name, value, ...options }),
  });
}
