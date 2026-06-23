import { createServiceClient } from "@vmd/supabase";
import { inngest } from "../client.js";

const ONE_DAY_MS = 86_400_000;

/** Daily sweep — emits one event per customer who hasn't ordered in 12+ days. */
export const quietCustomerCheck = inngest.createFunction(
  { id: "quiet-customer-check", name: "Quiet customer sweep" },
  { cron: "TZ=Asia/Kolkata 30 8 * * *" },
  async ({ step }) => {
    const detected = await step.run("scan", async () => {
      const supabase = createServiceClient();
      const { data: customers } = await supabase
        .from("customers")
        .select("id,farm_id")
        .eq("is_active", true);

      const result: Array<{ farmId: string; customerId: string; days: number }> = [];
      for (const c of customers ?? []) {
        const { data: lastSale } = await supabase
          .from("sales")
          .select("occurred_at")
          .eq("customer_id", c.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const days = lastSale
          ? Math.floor((Date.now() - new Date(lastSale.occurred_at).getTime()) / ONE_DAY_MS)
          : 999;
        if (days >= 12) result.push({ farmId: c.farm_id, customerId: c.id, days });
      }
      return result;
    });

    for (const r of detected) {
      await step.sendEvent(`quiet-${r.customerId}`, {
        name: "customer/quiet-detected",
        data: { farmId: r.farmId, customerId: r.customerId, days: r.days },
      });
    }
    return { detected: detected.length };
  },
);
