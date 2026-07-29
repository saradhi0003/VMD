import { DAILY_AGENT_SYSTEM } from "./prompts.js";
import { chatJson } from "./provider.js";
import { tools, FindingSchema, type FindingInput } from "./tools.js";

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

  // Validate findings INDIVIDUALLY. A provider that can't be grammar-constrained
  // will occasionally violate one field, and losing the whole run because one of
  // eight findings was malformed is the wrong trade for a best-effort advisor.
  const raw = JSON.parse(response.text) as { findings?: unknown[] };
  const candidates = Array.isArray(raw?.findings) ? raw.findings : [];
  const findings: FindingInput[] = [];
  let rejected = 0;
  for (const c of candidates) {
    const r = FindingSchema.safeParse(c);
    if (r.success) findings.push(r.data);
    else rejected++;
  }
  if (rejected) {
    console.warn(`[daily-agent] dropped ${rejected}/${candidates.length} malformed findings`);
  }
  if (findings.length === 0 && candidates.length > 0) {
    // Everything failed — that's a prompt/model problem worth surfacing, not swallowing.
    throw new Error(`daily-agent: all ${candidates.length} findings failed validation`);
  }

  return {
    findings,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    model: response.model,
    raw: response.raw,
  };
}
