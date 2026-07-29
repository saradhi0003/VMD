import { NextResponse } from "next/server";
import { providerChain, supportsVision } from "@vmd/llm";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Deployment health + configuration readout.
 *
 * Answers "is the *deployed* app actually wired up?" — the thing you can't tell
 * from a page that renders fine. Reports **names and booleans only**; never a
 * key, nor a URL carrying credentials. Safe to leave public: everything here is
 * either already visible or a yes/no.
 *
 * `status` is "ok" only for things the app genuinely cannot work without.
 * Optional integrations are reported, never failed on.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // Database — actually query it; don't just look for env vars.
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from("farms").select("id").limit(1);
    if (error) throw error;
    checks.database = "ok";
  } catch (err) {
    healthy = false;
    checks.database = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Approval gate — is migration 0005 applied to THIS environment?
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from("profiles").select("approved_at").limit(1);
    checks.approval_gate = error ? "migration 0005 NOT applied" : "ok";
  } catch {
    checks.approval_gate = "unknown";
  }

  // LLM — which tiers this deployment can reach, cheapest first.
  const chain = providerChain();
  checks.llm = {
    chain,
    active: chain[0] ?? "none",
    smart_scan: supportsVision() ? "available" : "unavailable (no vision-capable provider)",
    ...(chain.length === 0 ? { note: "offline regex fallback only" } : {}),
  };

  // Optional integrations — absence is a valid state, not a failure.
  checks.integrations = {
    site_url: process.env.NEXT_PUBLIC_SITE_URL
      ? "set"
      : "MISSING — magic links and invites will point at localhost",
    smtp: process.env.SMTP_HOST ? "configured" : "unset (admin notices skip)",
    inngest: process.env.INNGEST_EVENT_KEY ? "configured" : "unset (jobs are local-only)",
    whatsapp: process.env.WHATSAPP_ACCESS_TOKEN ? "configured" : "unset (send job no-ops)",
    mfa_enforced: process.env.MFA_ENFORCED === "true",
  };

  return NextResponse.json(
    { status: healthy ? "ok" : "error", at: new Date().toISOString(), checks },
    { status: healthy ? 200 : 503 },
  );
}
