import { createTransport, type Transporter } from "nodemailer";

/**
 * SMTP sender for operational email (Layer 2 of the SMTP story).
 *
 * Layer 1 — the auth emails themselves (magic links, invites, OTP) — is
 * *dashboard config*, not code: Supabase → Auth → Emails → SMTP settings.
 * Nothing here touches those.
 *
 * Ported from FinTracker's `worker/app/notify.py`. Python had `smtplib` in the
 * stdlib; Node doesn't, so this uses nodemailer — the one added dependency.
 *
 * Design rule carried over verbatim: **best-effort**. If SMTP isn't configured
 * this silently no-ops. Approval must never depend on email — the owner's Team
 * panel always shows pending requests and is the source of truth.
 */

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let cached: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 = implicit TLS; 587 = STARTTLS upgrade.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

/**
 * Send one message.
 * @returns true if it was actually sent; false if SMTP is unconfigured (skipped).
 * @throws on a real delivery failure, so the Inngest step can retry.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  if (!smtpConfigured()) {
    console.warn("[mailer] SMTP not configured — skipping send to", input.to);
    return false;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  await transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });
  return true;
}
