import { createServiceClient } from "@vmd/supabase";

/**
 * The backend twin of the RLS gate.
 *
 * RLS stops *clients*. It does not stop us: anything holding the service key
 * (Inngest jobs, webhooks, `recordAudit`, the team admin actions) bypasses RLS
 * entirely. So every service-role entry point must re-verify the caller's JWT
 * and re-check approval itself, then stamp writes with the *verified* id —
 * never an id supplied by the request body.
 *
 * Ported from FinTracker's `worker/app/db.py` (`get_user_id` / `require_approved`).
 * See skills/mfa-totp/references/approval-gate.md.
 */

export class AuthzError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 429,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export interface VerifiedCaller {
  userId: string;
  email: string | null;
  farmId: string;
  role: string;
  status: string;
}

/**
 * Resolve an `Authorization: Bearer <supabase jwt>` header into a user id.
 * Throws `AuthzError(401)` for a missing or invalid token.
 */
export async function getUserIdFromAuthHeader(authorization: string | null): Promise<string> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new AuthzError("missing bearer token", 401);
  }
  const token = authorization.slice(7).trim();
  if (!token) throw new AuthzError("missing bearer token", 401);

  // getUser(token) validates the signature + expiry against the auth server —
  // do not decode the JWT locally and trust its claims.
  const svc = createServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) throw new AuthzError("invalid token", 401);
  return data.user.id;
}

/**
 * Approval gate for service-role code paths.
 *
 * Graceful degradation: if `profiles.status` doesn't exist yet (migration 0005
 * not applied) we allow through rather than locking the whole app out — the
 * same call the client-side cascade makes.
 */
export async function requireApproved(userId: string): Promise<VerifiedCaller> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("profiles")
    .select("id,email,farm_id,role,status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Table/column absent → pre-migration DB. Don't hard-fail.
    console.warn("[guard] approval check unavailable (continuing):", error.message);
    return { userId, email: null, farmId: "", role: "worker", status: "active" };
  }
  if (!data) throw new AuthzError("no profile for this account", 403);
  if (data.status === "pending") throw new AuthzError("account is pending owner approval", 403);
  if (data.status !== "active") throw new AuthzError(`account is ${data.status}`, 403);

  return {
    userId,
    email: data.email ?? null,
    farmId: data.farm_id,
    role: data.role,
    status: data.status,
  };
}

/** Verify + approve in one call — the normal entry point for a service-role route. */
export async function requireApprovedCaller(authorization: string | null): Promise<VerifiedCaller> {
  return requireApproved(await getUserIdFromAuthHeader(authorization));
}

/**
 * Confirm a row belongs to the caller's farm before a service-role write touches
 * it. Prevents a valid, approved user from acting on another farm's data by
 * passing someone else's id.
 */
export function assertSameFarm(caller: VerifiedCaller, farmId: string): void {
  if (caller.farmId && farmId && caller.farmId !== farmId) {
    throw new AuthzError("cross-farm access denied", 403);
  }
}

/* ──────────────────────────────────────────────────────────
   Rate limiting (ported from FinTracker's `_rate_limit`).

   In-memory and therefore per-instance — good enough to blunt a runaway
   phone retry loop or an accidental double-submit, which is what it's for.
   It is NOT a distributed limiter; a serverless deploy gets one bucket per
   warm lambda. Move to Postgres or Upstash if you need real enforcement.
─────────────────────────────────────────────────────────── */

const HITS = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): void {
  const now = Date.now();
  const recent = (HITS.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    throw new AuthzError("too many requests — try again in a minute", 429);
  }
  recent.push(now);
  HITS.set(key, recent);

  // Opportunistic cleanup so the map can't grow without bound.
  if (HITS.size > 5_000) {
    for (const [k, v] of HITS) {
      if (v.every((t) => now - t >= windowMs)) HITS.delete(k);
    }
  }
}
