import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { safeNextPath } from "@/lib/safe-redirect";

/** Supabase OAuth + magic-link callback. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // MUST be sanitised: `new URL(next, base)` happily returns an off-site URL for
  // an absolute or protocol-relative `next`, which would bounce a just-signed-in
  // user to a look-alike domain. See lib/safe-redirect.ts.
  const next = safeNextPath(url.searchParams.get("next"), "/owner");

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/owner/login?error=auth_failed", request.url));
}
