import { createServiceClient } from "@vmd/supabase";
import { inngest } from "../client.js";
import { sendMail } from "../mailer.js";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * "Someone requested access" → email the farm owner(s).
 *
 * FinTracker did this inline with smtplib from its Python worker. VMD already
 * has Inngest, so it runs as a job instead: retries, backoff and observability
 * come free, and a flaky SMTP server can't slow down the user's click.
 *
 * Two behaviours preserved from `worker/app/notify.py`:
 *  • **best-effort** — no SMTP config means a clean skip, not a failure. The
 *    owner's Team panel is the source of truth for pending requests.
 *  • **`notified_at` is stamped only on a successful send**, so a failed
 *    delivery can be retried later rather than being silently marked done.
 */
export const accessRequestNotify = inngest.createFunction(
  {
    id: "access-request-notify",
    name: "Email the farm owner about a pending access request",
    retries: 3,
    // One notification per requesting user at a time.
    concurrency: { key: "event.data.userId", limit: 1 },
  },
  { event: "user/access.requested" },
  async ({ event, step }) => {
    const { farmId, userId, name, email } = event.data;
    const supabase = createServiceClient();

    // Who approves? Every active owner on this farm.
    const owners = await step.run("find-owners", async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("farm_id", farmId)
        .eq("role", "owner")
        .eq("status", "active");
      const list = (data ?? []).map((o) => o.email).filter((e): e is string => Boolean(e));
      // ADMIN_EMAIL is the always-on fallback (mirrors FinTracker's env).
      const fallback = process.env.ADMIN_EMAIL;
      if (fallback && !list.includes(fallback)) list.push(fallback);
      return list;
    });

    if (owners.length === 0) {
      return { skipped: true, reason: "no owner mailbox on this farm" };
    }

    const sent = await step.run("send-email", async () => {
      const who = name || email || userId;
      const results = await Promise.allSettled(
        owners.map((to) =>
          sendMail({
            to,
            subject: `Vayumukhi Dairy — ${who} is asking for access`,
            text: [
              `${who} (${email || "no email"}) signed in and is waiting for approval.`,
              "",
              "They can't see any farm data until you approve them.",
              "",
              `Approve or decline: ${SITE}/owner/team`,
            ].join("\n"),
          }),
        ),
      );
      // true only if at least one mailbox actually accepted it.
      return results.some((r) => r.status === "fulfilled" && r.value === true);
    });

    if (!sent) {
      // Not an error: SMTP is optional. Leave notified_at null so a later
      // attempt can still mark it, and let the Team panel carry the signal.
      return { notified: false, reason: "smtp not configured or all sends skipped" };
    }

    await step.run("stamp-notified", async () => {
      await supabase
        .from("profiles")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", userId);
    });

    return { notified: true, owners: owners.length };
  },
);
