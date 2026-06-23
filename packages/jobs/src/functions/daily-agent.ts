import { createServiceClient } from "@vmd/supabase";
import { runDailyAgent } from "@vmd/llm";
import { inngest } from "../client.js";
import { buildFarmSnapshot } from "../snapshot.js";

/** Cron — 06:00 IST every day, fans out one event per farm. */
export const dailyAgentCron = inngest.createFunction(
  { id: "daily-agent-cron", name: "Daily farm-check agent (cron)" },
  { cron: "TZ=Asia/Kolkata 0 6 * * *" },
  async ({ step }) => {
    const farms = await step.run("load-farms", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase.from("farms").select("id");
      return data ?? [];
    });

    for (const farm of farms) {
      await step.sendEvent(`enqueue-${farm.id}`, {
        name: "farm/daily-agent.requested",
        data: { farmId: farm.id, forDate: new Date().toISOString().slice(0, 10) },
      });
    }
    return { enqueued: farms.length };
  },
);

/** Per-farm agent run. */
export const dailyAgentOnDemand = inngest.createFunction(
  {
    id: "daily-agent-run",
    name: "Daily farm-check agent (per farm)",
    concurrency: { key: "event.data.farmId", limit: 1 },
    retries: 2,
  },
  { event: "farm/daily-agent.requested" },
  async ({ event, step }) => {
    const { farmId, forDate } = event.data;

    const snapshot = await step.run("build-snapshot", () => buildFarmSnapshot(farmId, forDate));

    const run = await step.run("insert-run", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("agent_runs")
        .insert({ farm_id: farmId, kind: "daily-agent" })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "agent_runs insert failed");
      return data;
    });

    try {
      const result = await step.run("call-claude", () => runDailyAgent(snapshot));

      await step.run("persist-findings", async () => {
        if (result.findings.length === 0) return;
        const supabase = createServiceClient();
        await supabase.from("agent_findings").insert(
          result.findings.map((f) => ({
            run_id: run.id,
            farm_id: farmId,
            severity: f.severity,
            title: f.title,
            detail: f.detail,
            suggested_action: f.suggested_action,
            related_entity: f.related_entity === "none" ? null : f.related_entity,
            related_entity_id: f.related_entity_id ?? null,
            confidence: f.confidence,
          })),
        );
      });

      await step.run("close-run", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("agent_runs")
          .update({
            finished_at: new Date().toISOString(),
            model: result.model,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
          })
          .eq("id", run.id);
      });

      const critical = result.findings.filter((f) => f.severity === "critical");
      if (critical.length > 0) {
        await step.sendEvent("notify-owner", {
          name: "whatsapp/send.requested",
          data: {
            farmId,
            to: "OWNER",
            body: `${critical.length} critical farm alert(s) today:\n${critical.map((c) => `• ${c.title}`).join("\n")}`,
            idempotencyKey: `daily-agent:${farmId}:${forDate}:critical`,
          },
        });
      }

      return { runId: run.id, findings: result.findings.length };
    } catch (err) {
      const supabase = createServiceClient();
      await supabase
        .from("agent_runs")
        .update({
          finished_at: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", run.id);
      throw err;
    }
  },
);
