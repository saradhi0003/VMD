import { createServiceClient } from "@vmd/supabase";
import { NextResponse } from "next/server";

/** Meta Cloud API webhook for delivery / read receipts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string;
            status: "sent" | "delivered" | "read" | "failed";
            timestamp: string;
            errors?: Array<{ title?: string; message?: string }>;
          }>;
        };
      }>;
    }>;
  };

  const statuses =
    body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? []) ?? [];

  const supabase = createServiceClient();
  for (const s of statuses) {
    const ts = new Date(Number(s.timestamp) * 1000).toISOString();
    const patch: {
      status: "sent" | "delivered" | "read" | "failed";
      delivered_at?: string;
      read_at?: string;
      failed_reason?: string;
    } = { status: s.status };
    if (s.status === "delivered") patch.delivered_at = ts;
    if (s.status === "read") patch.read_at = ts;
    if (s.status === "failed") patch.failed_reason = s.errors?.[0]?.message ?? "unknown";
    await supabase.from("whatsapp_messages").update(patch).eq("provider_message_id", s.id);
  }

  return NextResponse.json({ ok: true });
}
