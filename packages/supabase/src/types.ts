/**
 * Hand-rolled types matching supabase/migrations/*.sql.
 * Replace this file by running:
 *   npx supabase gen types typescript --project-id <REF> > packages/supabase/src/types.ts
 * once the project is provisioned.
 *
 * Shapes conform to @supabase/supabase-js' GenericSchema contract (each table
 * carries a `Relationships` array; the schema exposes Views/Functions/Enums/
 * CompositeTypes) so typed `.from()` queries infer real row types, not `never`.
 */

export type Role = "owner" | "worker" | "read_only";
export type AnimalType = "cow" | "buffalo" | "calf";
export type AnimalStatus = "milking" | "dry" | "pregnant" | "calf" | "sold" | "deceased";
export type HealthStatus = "healthy" | "observation" | "treatment" | "quarantine" | "recovered";
export type Shift = "morning" | "evening";
export type ReminderPriority = "low" | "medium" | "high";
export type ReminderType = "doctor" | "fodder" | "feed" | "vaccination" | "delivery" | "other";
export type WhatsappStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type AgentFindingSeverity = "info" | "warning" | "critical";

/** Wraps a table's Row/Insert into the shape supabase-js expects. */
type Table<R, I, Rel extends readonly unknown[] = []> = {
  Row: R;
  Insert: I;
  Update: Partial<I>;
  Relationships: Rel;
};

export interface Database {
  public: {
    Tables: {
      farms: Table<
        { id: string; name: string; timezone: string; owner_whatsapp: string | null; created_at: string },
        { id?: string; name: string; timezone?: string; owner_whatsapp?: string | null }
      >;
      profiles: Table<
        { id: string; farm_id: string; name: string; role: Role; status: string; email: string | null; image: string | null; created_at: string },
        { id: string; farm_id: string; name: string; role?: Role; status?: string; email?: string | null; image?: string | null }
      >;
      animals: Table<
        { id: string; farm_id: string; tag: string; name: string; type: AnimalType; status: AnimalStatus; health: HealthStatus; dob: string | null; photo_url: string | null; notes: string | null; created_at: string },
        { id?: string; farm_id: string; tag: string; name: string; type: AnimalType; status?: AnimalStatus; health?: HealthStatus; dob?: string | null; photo_url?: string | null; notes?: string | null }
      >;
      animal_health_events: Table<
        { id: string; farm_id: string; animal_id: string; occurred_at: string; kind: string; details: string | null; vet_name: string | null; medication: string | null; withdrawal_until: string | null; created_by: string | null; created_at: string },
        { id?: string; farm_id: string; animal_id: string; occurred_at: string; kind: string; details?: string | null; vet_name?: string | null; medication?: string | null; withdrawal_until?: string | null; created_by?: string | null },
        [
          {
            foreignKeyName: "animal_health_events_animal_id_fkey";
            columns: ["animal_id"];
            isOneToOne: false;
            referencedRelation: "animals";
            referencedColumns: ["id"];
          },
        ]
      >;
      activity_logs: Table<
        { id: string; farm_id: string; user_id: string | null; kind: string; animal_id: string | null; note: string | null; photo_url: string | null; payload: unknown; created_at: string },
        { id?: string; farm_id: string; user_id?: string | null; kind: string; animal_id?: string | null; note?: string | null; photo_url?: string | null; payload?: unknown }
      >;
      scan_events: Table<
        { id: string; farm_id: string; user_id: string | null; image_url: string; ocr_text: string | null; parsed: unknown; confidence: number | null; applied_session_id: string | null; created_at: string },
        { id?: string; farm_id: string; user_id?: string | null; image_url: string; ocr_text?: string | null; parsed?: unknown; confidence?: number | null; applied_session_id?: string | null }
      >;
      voice_entries: Table<
        { id: string; farm_id: string; user_id: string | null; audio_url: string | null; language: string | null; transcript: string | null; parsed: unknown; confidence: number | null; applied_session_id: string | null; created_at: string },
        { id?: string; farm_id: string; user_id?: string | null; audio_url?: string | null; language?: string | null; transcript?: string | null; parsed?: unknown; confidence?: number | null; applied_session_id?: string | null }
      >;
      milk_sessions: Table<
        { id: string; farm_id: string; session_date: string; shift: Shift; animal_id: string | null; litres: string; fat_pct: number | null; snf_pct: number | null; milker_id: string | null; photo_url: string | null; reverses_id: string | null; source: string; created_at: string },
        { id?: string; farm_id: string; session_date: string; shift: Shift; animal_id?: string | null; litres: string | number; fat_pct?: number | null; snf_pct?: number | null; milker_id?: string | null; photo_url?: string | null; reverses_id?: string | null; source?: string }
      >;
      customers: Table<
        { id: string; farm_id: string; name: string; phone: string | null; whatsapp: string | null; address: string | null; route: string | null; notes: string | null; is_active: boolean; created_at: string },
        { id?: string; farm_id: string; name: string; phone?: string | null; whatsapp?: string | null; address?: string | null; route?: string | null; notes?: string | null; is_active?: boolean }
      >;
      products: Table<
        { id: string; farm_id: string; slug: string; name: string; unit: string; price_minor: number; is_active: boolean },
        { id?: string; farm_id: string; slug: string; name: string; unit: string; price_minor: number; is_active?: boolean }
      >;
      sales: Table<
        { id: string; farm_id: string; customer_id: string | null; product_id: string | null; occurred_at: string; qty: string; amount_minor: number; reverses_id: string | null; created_by: string | null; created_at: string },
        { id?: string; farm_id: string; customer_id?: string | null; product_id?: string | null; occurred_at: string; qty: string | number; amount_minor: number; reverses_id?: string | null; created_by?: string | null }
      >;
      expenses: Table<
        { id: string; farm_id: string; occurred_at: string; category: string; description: string | null; amount_minor: number; receipt_url: string | null; reverses_id: string | null; created_by: string | null; created_at: string },
        { id?: string; farm_id: string; occurred_at: string; category: string; description?: string | null; amount_minor: number; receipt_url?: string | null; reverses_id?: string | null; created_by?: string | null }
      >;
      reminders: Table<
        { id: string; farm_id: string; due_at: string; type: ReminderType; title: string; owner_label: string | null; priority: ReminderPriority; done_at: string | null; created_at: string },
        { id?: string; farm_id: string; due_at: string; type: ReminderType; title: string; owner_label?: string | null; priority?: ReminderPriority; done_at?: string | null }
      >;
      notifications: Table<
        { id: string; user_id: string; title: string; body: string; tone: string; read_at: string | null; created_at: string },
        { id?: string; user_id: string; title: string; body: string; tone?: string; read_at?: string | null }
      >;
      whatsapp_messages: Table<
        { id: string; farm_id: string; to_number: string; template: string | null; body: string; payload: unknown; status: WhatsappStatus; provider_message_id: string | null; sent_at: string | null; delivered_at: string | null; read_at: string | null; failed_reason: string | null; created_at: string },
        { id?: string; farm_id: string; to_number: string; template?: string | null; body: string; payload?: unknown; status?: WhatsappStatus; provider_message_id?: string | null; sent_at?: string | null; delivered_at?: string | null; read_at?: string | null; failed_reason?: string | null }
      >;
      agent_runs: Table<
        { id: string; farm_id: string; kind: string; started_at: string; finished_at: string | null; model: string | null; input_tokens: number | null; output_tokens: number | null; cost_usd: string | null; error: string | null },
        { id?: string; farm_id: string; kind: string; started_at?: string; finished_at?: string | null; model?: string | null; input_tokens?: number | null; output_tokens?: number | null; cost_usd?: string | null; error?: string | null }
      >;
      agent_findings: Table<
        { id: string; run_id: string; farm_id: string; severity: AgentFindingSeverity; title: string; detail: string; suggested_action: string | null; related_entity: string | null; related_entity_id: string | null; confidence: number | null; dismissed: boolean; created_at: string },
        { id?: string; run_id: string; farm_id: string; severity?: AgentFindingSeverity; title: string; detail: string; suggested_action?: string | null; related_entity?: string | null; related_entity_id?: string | null; confidence?: number | null; dismissed?: boolean }
      >;
      audit_log: Table<
        { id: string; farm_id: string | null; user_id: string | null; action: string; entity: string; entity_id: string | null; diff: unknown; ip: string | null; user_agent: string | null; created_at: string },
        { id?: string; farm_id?: string | null; user_id?: string | null; action: string; entity: string; entity_id?: string | null; diff?: unknown; ip?: string | null; user_agent?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role: Role;
      animal_type: AnimalType;
      animal_status: AnimalStatus;
      health_status: HealthStatus;
      shift: Shift;
      reminder_priority: ReminderPriority;
      reminder_type: ReminderType;
      whatsapp_status: WhatsappStatus;
      agent_finding_severity: AgentFindingSeverity;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type Profile = Tables<"profiles">;
export type Farm = Tables<"farms">;
export type Animal = Tables<"animals">;
export type MilkSession = Tables<"milk_sessions">;
export type ActivityLog = Tables<"activity_logs">;
export type HealthEvent = Tables<"animal_health_events">;
export type Reminder = Tables<"reminders">;
export type AgentFinding = Tables<"agent_findings">;
