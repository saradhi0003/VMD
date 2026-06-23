import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/** Lands an invited user (from the email link), establishes their session, then onboarding. */
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/onboard", request.url));
  }
  return NextResponse.redirect(new URL("/owner/login?error=invite_expired", request.url));
}
