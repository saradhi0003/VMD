import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/** Clears the Supabase session and returns to the marketing page. */
async function signOut(request: NextRequest) {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

// POST is the safe default (CSRF-resistant); GET supported for plain links.
export const POST = signOut;
export const GET = signOut;
