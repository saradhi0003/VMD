import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";
import type { Profile, Role } from "@vmd/supabase";

/**
 * Whether a role must complete MFA (TOTP) to use the app.
 *
 * Gated by the `MFA_ENFORCED` env flag so MFA is **off by default** — deploy and
 * test without it, then set `MFA_ENFORCED=true` (and enable TOTP in the Supabase
 * dashboard) to turn it on for everyone. To require it for owners only, return
 * `enforced && role !== "worker"`.
 */
export function mfaRequiredFor(_role: Role): boolean {
  return process.env.MFA_ENFORCED === "true";
}

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
}

async function loadSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
  };
}

export async function getSession(): Promise<SessionContext | null> {
  return loadSession();
}

export async function requireOwner(): Promise<SessionContext> {
  const s = await loadSession();
  if (!s) redirect("/owner/login");
  if (s.profile.role !== "owner") redirect("/worker");
  return s;
}

export async function requireWorker(): Promise<SessionContext> {
  const s = await loadSession();
  if (!s) redirect("/worker/login");
  return s;
}

/** Synthetic email used to log workers in via Supabase Auth password flow. */
export function workerEmail(name: string): string {
  return `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}@worker.vmd.local`;
}
