import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

export const events = {
  "farm/daily-agent.requested": {
    data: z.object({ farmId: z.string().uuid(), forDate: z.string() }),
  },
  "milk-session/created": {
    data: z.object({ farmId: z.string().uuid(), sessionId: z.string().uuid() }),
  },
  "customer/quiet-detected": {
    data: z.object({ farmId: z.string().uuid(), customerId: z.string().uuid(), days: z.number() }),
  },
  "whatsapp/send.requested": {
    data: z.object({
      farmId: z.string().uuid(),
      to: z.string(),
      body: z.string(),
      template: z.string().optional(),
      idempotencyKey: z.string(),
    }),
  },
};

export const inngest = new Inngest({
  id: "vmd",
  schemas: new EventSchemas().fromZod(events),
});

/**
 * Fire an event best-effort: the orchestrator is a side channel, so a missing
 * INNGEST key or an unreachable dev server must never break the user's action
 * (e.g. logging milk). Failures are logged, not thrown.
 */
export async function emit(...args: Parameters<typeof inngest.send>): Promise<void> {
  try {
    await inngest.send(...args);
  } catch (err) {
    console.warn("[inngest] emit failed (continuing):", err instanceof Error ? err.message : err);
  }
}
