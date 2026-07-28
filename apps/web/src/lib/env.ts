import { z } from "zod";

/**
 * Environment validation. Imported by `src/instrumentation.ts` so it runs once
 * when the server boots — a bad config fails loudly at startup instead of
 * surfacing as a confusing 500 on some unrelated page later.
 *
 * `.env.example` ships every optional var as `FOO=""`, and a blank value there
 * means "not configured". Plain `.optional()` disagrees: it sees `""` as
 * *present*, so `z.string().url().optional()` rejects an empty `SUPABASE_URL`
 * and takes the whole app down over a variable nobody set. `blank()` below
 * normalises `""` → `undefined` first, which is what everyone actually means.
 */

/** An optional value where an empty string means "unset". */
function blank<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
}

const Env = z
  .object({
    // Required — the app genuinely cannot run without these.
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),

    // Accept either the new "publishable" name or the legacy "anon" name.
    NEXT_PUBLIC_PUBLISHABLE_KEY: blank(z.string()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blank(z.string()),
    // Accept either the new "secret" name or the legacy "service_role" name.
    SUPABASE_SECRET_KEY: blank(z.string()),
    SUPABASE_SERVICE_ROLE_KEY: blank(z.string()),
    SUPABASE_URL: blank(z.string().url()),

    // Self-hosted / OpenAI-compatible LLM (Colab vLLM). Wins over Anthropic.
    LLM_PROVIDER: blank(z.enum(["openai-compat", "anthropic"])),
    LLM_BASE_URL: blank(z.string().url()),
    LLM_API_KEY: blank(z.string()),
    LLM_MODEL_AGENT: blank(z.string()),
    LLM_MODEL_FAST: blank(z.string()),
    // Range-checked in packages/llm/src/provider.ts; a string here.
    LLM_TIMEOUT_MS: blank(z.string()),
    ANTHROPIC_API_KEY: blank(z.string()),

    // SMTP — Layer 2 only (admin "access requested" notifications). The auth
    // emails themselves are configured in the Supabase dashboard, not here.
    // All optional: with none set, notifications skip and approval still works
    // via the owner's Team panel.
    SMTP_HOST: blank(z.string()),
    SMTP_PORT: blank(z.string()),
    SMTP_USER: blank(z.string()),
    SMTP_PASS: blank(z.string()),
    SMTP_FROM: blank(z.string()),
    ADMIN_EMAIL: blank(z.string().email()),

    INNGEST_EVENT_KEY: blank(z.string()),
    INNGEST_SIGNING_KEY: blank(z.string()),
    WHATSAPP_PHONE_NUMBER_ID: blank(z.string()),
    WHATSAPP_ACCESS_TOKEN: blank(z.string()),
    WHATSAPP_VERIFY_TOKEN: blank(z.string()),
    FARM_TIMEZONE: z.string().default("Asia/Kolkata"),
    OWNER_WHATSAPP_NUMBER: blank(z.string()),
  })
  .refine(
    (e) => Boolean(e.NEXT_PUBLIC_PUBLISHABLE_KEY ?? e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    { message: "Either NEXT_PUBLIC_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set" },
  );

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. See .env.example.");
}

export const env = parsed.data;
