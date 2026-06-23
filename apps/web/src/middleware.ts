import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: { name: string; value: string; options?: CookieOptions }[]) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const ownerArea = path.startsWith("/owner") && !path.startsWith("/owner/login");
  const workerArea = path.startsWith("/worker") && !path.startsWith("/worker/login");

  if (ownerArea || workerArea) {
    const loginPath = ownerArea ? "/owner/login" : "/worker/login";
    if (!user) return NextResponse.redirect(new URL(loginPath, request.url));

    // `status` requires migration 0004 — fall back to role-only so the app keeps
    // working (and MFA stays enforced) if that migration hasn't been applied yet.
    let profile: { role?: string; status?: string } | null = null;
    const withStatus = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
    if (withStatus.error) {
      const roleOnly = await supabase.from("profiles").select("role").eq("id", user.id).single();
      profile = roleOnly.data as { role?: string } | null;
    } else {
      profile = withStatus.data as { role?: string; status?: string };
    }

    // disabled accounts can't enter
    if (profile?.status === "disabled") {
      return NextResponse.redirect(new URL(`${loginPath}?error=account_disabled`, request.url));
    }

    // owner area is owner-only
    if (ownerArea && profile?.role !== "owner") {
      return NextResponse.redirect(new URL("/worker", request.url));
    }

    // MFA — off by default; set MFA_ENFORCED=true (and enable TOTP in Supabase) to turn on.
    const mfaRequired = process.env.MFA_ENFORCED === "true";
    if (mfaRequired) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const nextParam = encodeURIComponent(path);
      if (aal) {
        if (aal.nextLevel === "aal1") {
          // no verified factor enrolled yet → set one up
          return NextResponse.redirect(new URL(`/mfa/enroll?next=${nextParam}`, request.url));
        }
        if (aal.currentLevel !== "aal2" && aal.nextLevel === "aal2") {
          // factor exists, session not yet stepped up → challenge
          return NextResponse.redirect(new URL(`/mfa?next=${nextParam}`, request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/owner/:path*", "/worker/:path*"],
};
