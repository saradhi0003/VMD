import { z } from "zod";

/* ──────────────────────────────────────────────────────────
   Tool schemas. Each tool gets:
     1. a Zod schema (used to validate Claude's tool_use input)
     2. an Anthropic Tool definition (sent to the API)
   We keep these in lockstep so what the model "may" produce
   matches what we accept.
─────────────────────────────────────────────────────────── */

export const FindingSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string().min(4).max(200),
  detail: z.string().min(8).max(1200),
  suggested_action: z.string().min(4).max(400),
  related_entity: z.enum(["animal", "customer", "milk_session", "expense", "reminder", "none"]).default("none"),
  related_entity_id: z.string().uuid().optional().nullable(),
  confidence: z.number().min(0).max(1),
});

export const RecordFindingsSchema = z.object({
  findings: z.array(FindingSchema).max(8),
});

export const ProposeReminderSchema = z.object({
  due_at: z.string().describe("ISO-8601 timestamp"),
  type: z.enum(["doctor", "fodder", "feed", "vaccination", "delivery", "other"]),
  title: z.string().min(4).max(200),
  owner_label: z.string().max(120).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const ProposeWhatsappDraftSchema = z.object({
  to_label: z.string().describe("Human name. The job layer resolves to a phone number."),
  body: z.string().min(4).max(1024),
  reason: z.string().describe("Why this message is being suggested. Shown to owner before send."),
});

export const ParseMilkSessionSchema = z.object({
  animal_tag_or_name: z.string().optional(),
  litres: z.number().positive().optional(),
  fat_pct: z.number().min(0).max(15).optional(),
  shift: z.enum(["morning", "evening"]).optional(),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export const ParseScanSchema = z.object({
  animal_tag: z.string().optional(),
  animal_name: z.string().optional(),
  session_date: z.string().optional().describe("YYYY-MM-DD"),
  shift: z.enum(["morning", "evening"]).optional(),
  litres: z.number().positive().optional(),
  fat_pct: z.number().min(0).max(15).optional(),
  confidence: z.number().min(0).max(1),
});

export const tools = {
  record_findings: {
    name: "record_findings",
    description:
      "Record the agent's findings for the farm. Call this exactly once with the full list.",
    input_schema: {
      type: "object" as const,
      properties: {
        findings: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["info", "warning", "critical"] },
              title: { type: "string" },
              detail: { type: "string" },
              suggested_action: { type: "string" },
              related_entity: {
                type: "string",
                enum: ["animal", "customer", "milk_session", "expense", "reminder", "none"],
              },
              related_entity_id: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["severity", "title", "detail", "suggested_action", "confidence"],
          },
        },
      },
      required: ["findings"],
    },
  },
  propose_reminder: {
    name: "propose_reminder",
    description: "Propose a reminder for the owner to confirm. Does not write the DB directly.",
    input_schema: {
      type: "object" as const,
      properties: {
        due_at: { type: "string" },
        type: {
          type: "string",
          enum: ["doctor", "fodder", "feed", "vaccination", "delivery", "other"],
        },
        title: { type: "string" },
        owner_label: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["due_at", "type", "title"],
    },
  },
  propose_whatsapp_draft: {
    name: "propose_whatsapp_draft",
    description:
      "Propose a WhatsApp message draft for the owner to review. Never sends directly.",
    input_schema: {
      type: "object" as const,
      properties: {
        to_label: { type: "string" },
        body: { type: "string" },
        reason: { type: "string" },
      },
      required: ["to_label", "body", "reason"],
    },
  },
} as const;

export type FindingInput = z.infer<typeof FindingSchema>;
export type RecordFindingsInput = z.infer<typeof RecordFindingsSchema>;
export type ProposeReminderInput = z.infer<typeof ProposeReminderSchema>;
export type ProposeWhatsappDraftInput = z.infer<typeof ProposeWhatsappDraftSchema>;
