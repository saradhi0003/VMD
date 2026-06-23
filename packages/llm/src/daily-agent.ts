import { anthropic, MODEL_AGENT } from "./index.js";
import { DAILY_AGENT_SYSTEM } from "./prompts.js";
import { tools, RecordFindingsSchema, type FindingInput } from "./tools.js";

/**
 * Input snapshot the orchestrator builds from the DB before invoking the agent.
 * Keep this tight — anything we pass costs tokens.
 */
export interface FarmSnapshot {
  farmName: string;
  today: string;
  yesterday: {
    morning: number | null;
    evening: number | null;
    fatPct: number | null;
  };
  last7Days: Array<{ date: string; total: number; fatPct: number | null }>;
  missingEntries: Array<{ date: string; shift: "morning" | "evening" }>;
  upcomingReminders: Array<{ dueAt: string; title: string; priority: string }>;
  quietCustomers: Array<{ name: string; daysSinceLastOrder: number }>;
  recentHealthEvents: Array<{ animal: string; kind: string; daysAgo: number }>;
}

export interface DailyAgentResult {
  findings: FindingInput[];
  inputTokens: number;
  outputTokens: number;
  model: string;
  raw: unknown;
}

export async function runDailyAgent(snapshot: FarmSnapshot): Promise<DailyAgentResult> {
  const userPrompt = `Farm: ${snapshot.farmName}
Today: ${snapshot.today}

Yesterday's milk: morning=${snapshot.yesterday.morning ?? "MISSING"} L, evening=${snapshot.yesterday.evening ?? "MISSING"} L, fat=${snapshot.yesterday.fatPct ?? "—"}%

Last 7 days production:
${snapshot.last7Days.map((d) => `  ${d.date}: ${d.total} L${d.fatPct != null ? ` · ${d.fatPct}% fat` : ""}`).join("\n")}

Missing entries: ${snapshot.missingEntries.length === 0 ? "none" : snapshot.missingEntries.map((m) => `${m.date} ${m.shift}`).join(", ")}

Upcoming reminders (next 7 days):
${snapshot.upcomingReminders.map((r) => `  ${r.dueAt} · [${r.priority}] ${r.title}`).join("\n") || "  none"}

Quiet customers (haven't ordered in 10+ days):
${snapshot.quietCustomers.map((c) => `  ${c.name} — ${c.daysSinceLastOrder} days`).join("\n") || "  none"}

Recent health events (last 14 days):
${snapshot.recentHealthEvents.map((h) => `  ${h.daysAgo}d ago · ${h.animal} · ${h.kind}`).join("\n") || "  none"}

Produce findings now. Use the record_findings tool.`;

  const response = await anthropic.messages.create({
    model: MODEL_AGENT,
    max_tokens: 2048,
    system: DAILY_AGENT_SYSTEM,
    tools: [tools.record_findings, tools.propose_reminder, tools.propose_whatsapp_draft],
    tool_choice: { type: "tool", name: "record_findings" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolBlock = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> =>
      b.type === "tool_use" && b.name === "record_findings",
  );
  if (!toolBlock) {
    throw new Error("daily-agent: model did not call record_findings");
  }

  const parsed = RecordFindingsSchema.parse(toolBlock.input);

  return {
    findings: parsed.findings,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
    raw: response,
  };
}
