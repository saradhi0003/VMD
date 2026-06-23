import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { addWorker, inviteUser, setUserRole, setUserStatus } from "./actions";

const roleLabel: Record<string, string> = { owner: "Owner", worker: "Worker", read_only: "Read-only" };
const statusTone: Record<string, string> = {
  active: "bg-ok/10 text-ok",
  invited: "bg-surface-alt text-navy",
  disabled: "bg-warn/10 text-warn",
};

export default async function TeamPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select("id,name,role,status,email,created_at")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: true });
  const members = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Team &amp; access</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Who can use the farm</h1>
        <p className="mt-1 text-ink-2">Invite staff, add workers, and manage roles. Everyone signs in with MFA.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-serif text-xl text-ink">Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-6">
            <EmptyState icon="👥" title="No members yet" hint="Invite someone below." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const isSelf = m.id === session.userId;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{m.name}</span>
                      <span className={`rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${statusTone[m.status] ?? "bg-surface-alt text-ink-2"}`}>
                        {m.status}
                      </span>
                      {isSelf && <span className="font-mono text-[10px] text-ink-3">you</span>}
                    </div>
                    <div className="font-mono text-xs text-ink-3">{m.email ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={setUserRole} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={m.id} />
                      <Select name="role" defaultValue={m.role} className="!py-1.5 text-xs" aria-label={`Role for ${m.name}`}>
                        <option value="owner">Owner</option>
                        <option value="worker">Worker</option>
                        <option value="read_only">Read-only</option>
                      </Select>
                      <Button type="submit" variant="secondary" className="!px-3 !py-1.5 text-xs">Save</Button>
                    </form>
                    {!isSelf && (
                      <form action={setUserStatus}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="status" value={m.status === "disabled" ? "active" : "disabled"} />
                        <Button type="submit" variant={m.status === "disabled" ? "secondary" : "danger"} className="!px-3 !py-1.5 text-xs">
                          {m.status === "disabled" ? "Enable" : "Disable"}
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invite staff or co-owner" />
          <p className="mb-4 text-sm text-ink-2">They get an email link to set a password and enrol MFA.</p>
          <form action={inviteUser} className="space-y-4">
            <Field label="Name"><Input name="name" required placeholder="e.g. Priya" /></Field>
            <Field label="Email"><Input name="email" type="email" required placeholder="priya@example.com" /></Field>
            <Field label="Role">
              <Select name="role" defaultValue="read_only">
                <option value="read_only">Read-only</option>
                <option value="owner">Owner</option>
              </Select>
            </Field>
            <Button type="submit">Send invite</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Add a worker" />
          <p className="mb-4 text-sm text-ink-2">Workers sign in with name + PIN at the shed (then an MFA code).</p>
          <form action={addWorker} className="space-y-4">
            <Field label="Name"><Input name="name" required placeholder="e.g. Mahesh" /></Field>
            <Field label="PIN" hint="6–8 digits — share it with the worker.">
              <Input name="pin" inputMode="numeric" pattern="\d{6,8}" maxLength={8} required placeholder="●●●●●●" />
            </Field>
            <Button type="submit" variant="secondary">Create worker</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
