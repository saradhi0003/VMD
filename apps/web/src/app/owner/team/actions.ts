"use server";

import { createServiceClient } from "@vmd/supabase";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner, workerEmail } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const InviteInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["owner", "read_only"]),
});

/** Invite a co-owner / staff member by email. They set a password + MFA on accept. */
export async function inviteUser(formData: FormData) {
  const session = await requireOwner();
  const parsed = InviteInput.parse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.inviteUserByEmail(parsed.email, {
    data: { farm_id: session.profile.farm_id, name: parsed.name, role: parsed.role },
    redirectTo: `${SITE}/auth/accept-invite`,
  });
  if (error) throw new Error(error.message);
  if (data.user) {
    await svc.from("profiles").update({ status: "invited" }).eq("id", data.user.id);
  }

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "invite",
    entity: "user",
    entityId: data.user?.id,
    diff: { email: parsed.email, role: parsed.role },
  });
  revalidatePath("/owner/team");
}

const WorkerInput = z.object({
  name: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{6,8}$/, "PIN must be 6–8 digits"),
});

/** Create a worker account (name + PIN, synthetic email). They enrol MFA on first login. */
export async function addWorker(formData: FormData) {
  const session = await requireOwner();
  const parsed = WorkerInput.parse({ name: formData.get("name"), pin: formData.get("pin") });

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email: workerEmail(parsed.name),
    password: parsed.pin,
    email_confirm: true,
    user_metadata: { farm_id: session.profile.farm_id, name: parsed.name, role: "worker" },
  });
  if (error) throw new Error(error.message);

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "worker",
    entityId: data.user?.id,
    diff: { name: parsed.name },
  });
  revalidatePath("/owner/team");
}

const RoleInput = z.object({ userId: z.string().uuid(), role: z.enum(["owner", "worker", "read_only"]) });
export async function setUserRole(formData: FormData) {
  const session = await requireOwner();
  const { userId, role } = RoleInput.parse({ userId: formData.get("userId"), role: formData.get("role") });

  const svc = createServiceClient();
  const { error } = await svc.from("profiles").update({ role }).eq("id", userId).eq("farm_id", session.profile.farm_id);
  if (error) throw new Error(error.message);

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "update_role", entity: "user", entityId: userId, diff: { role } });
  revalidatePath("/owner/team");
}

const StatusInput = z.object({ userId: z.string().uuid(), status: z.enum(["active", "disabled"]) });
export async function setUserStatus(formData: FormData) {
  const session = await requireOwner();
  const { userId, status } = StatusInput.parse({ userId: formData.get("userId"), status: formData.get("status") });
  if (userId === session.userId) throw new Error("You can't disable your own account.");

  const svc = createServiceClient();
  const { error } = await svc.from("profiles").update({ status }).eq("id", userId).eq("farm_id", session.profile.farm_id);
  if (error) throw new Error(error.message);

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "set_status", entity: "user", entityId: userId, diff: { status } });
  revalidatePath("/owner/team");
}
