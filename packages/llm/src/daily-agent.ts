import { DAILY_AGENT_SYSTEM } from "./prompts.js";
import { chatJson } from "./provider.js";
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

  const response = await chatJson({
    system: DAILY_AGENT_SYSTEM,
    user: userPrompt,
    maxTokens: 2048,
    jsonSchema: {
      name: "record_findings",
      schema: tools.record_findings.input_schema as unknown as Record<string, unknown>,
    },
  });

  const parsed = RecordFindingsSchema.parse(JSON.parse(response.text));

  return {
    findings: parsed.findings,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    model: response.model,
    raw: response.raw,
  };
}
