import { createServiceClient } from "@vmd/supabase";
import { requireOwner } from "@/lib/auth";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

const toneDot: Record<string, string> = { warn: "bg-warn", info: "bg-blue", success: "bg-ok" };

export default async function NotificationsPage() {
  const session = await requireOwner();
  const svc = createServiceClient();
  const { data } = await svc
    .from("notifications")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const notes = data ?? [];
  const unread = notes.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "All caught up"} backHref="/owner" />
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary" size="md">Mark all read</Button>
          </form>
        )}
      </div>

      {notes.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" hint="Alerts from the farm-check agent and quiet-customer sweep land here." />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read_at ? "" : "bg-surface-alt/40"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[n.tone] ?? "bg-ink-3"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">{n.title}</strong>
                    <span className="shrink-0 font-mono text-xs text-ink-3">
                      {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>
                </div>
                {!n.read_at && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="shrink-0 text-xs text-ink-2 underline hover:text-ink">Mark read</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
