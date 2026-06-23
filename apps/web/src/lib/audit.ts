import { headers } from "next/headers";
import { createServiceClient } from "@vmd/supabase";

export interface AuditEntry {
  farmId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string;
  diff?: unknown;
}

/**
 * Append a tamper-resistant audit row.
 *
 * Uses the service-role client on purpose: `audit_log` has RLS enabled with no
 * user-facing INSERT policy, so users cannot forge entries. The service client
 * bypasses RLS, guaranteeing the audit always records.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const supabase = createServiceClient();
  const h = await headers();
  const { error } = await supabase.from("audit_log").insert({
    farm_id: entry.farmId,
    user_id: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    diff: (entry.diff ?? null) as never,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: h.get("user-agent") ?? null,
  });
  // Audit must never break the user's action, but failures should be visible.
  if (error) console.error("[audit] failed to record entry", entry.entity, error.message);
}
