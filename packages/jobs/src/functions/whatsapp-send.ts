import { createServiceClient } from "@vmd/supabase";
import { inngest } from "../client.js";

const META_URL = "https://graph.facebook.com/v21.0";

export const whatsappSend = inngest.createFunction(
  {
    id: "whatsapp-send",
    name: "Send WhatsApp message via Meta Cloud API",
    retries: 4,
    concurrency: { key: "event.data.farmId", limit: 5 },
  },
  { event: "whatsapp/send.requested" },
  async ({ event, step }) => {
    const { farmId, to, body, idempotencyKey } = event.data;
    const supabase = createServiceClient();

    /* Idempotency check via the outbox table */
    const existing = await step.run("dedup", async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id,status")
        .contains("payload", { idempotency_key: idempotencyKey })
        .limit(1)
        .maybeSingle();
      return data;
    });
    if (existing) return { skipped: true, reason: "duplicate", id: existing.id };

    const { data: farm } = await supabase
      .from("farms")
      .select("owner_whatsapp")
      .eq("id", farmId)
      .single();
    if (!farm) throw new Error(`unknown farm ${farmId}`);

    const resolvedTo = to === "OWNER" ? farm.owner_whatsapp : to;
    if (!resolvedTo) throw new Error("no destination phone number");

    const { data: outbox, error: insErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        farm_id: farmId,
        to_number: resolvedTo,
        body,
        status: "queued",
        payload: { idempotency_key: idempotencyKey },
      })
      .select()
      .single();
    if (insErr || !outbox) throw new Error(insErr?.message ?? "outbox insert failed");

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneId || !token) {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "failed", failed_reason: "missing WHATSAPP_PHONE_NUMBER_ID/TOKEN" })
        .eq("id", outbox.id);
      return { skipped: true, reason: "no-credentials", id: outbox.id };
    }

    const res = await step.run("call-meta", async () => {
      const r = await fetch(`${META_URL}/${phoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: resolvedTo,
          type: "text",
          text: { body },
        }),
      });
      const data = (await r.json()) as { messages?: Array<{ id: string }>; error?: unknown };
      if (!r.ok) throw new Error(`meta-error: ${JSON.stringify(data.error ?? data)}`);
      return data;
    });

    const providerMessageId = res.messages?.[0]?.id ?? null;
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      })
      .eq("id", outbox.id);

    return { id: outbox.id, providerMessageId };
  },
);
