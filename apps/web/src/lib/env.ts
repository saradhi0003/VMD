import { z } from "zod";

const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Accept either the new "publishable" name or the legacy "anon" name.
  NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  // Accept either the new "secret" name or the legacy "service_role" name.
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  FARM_TIMEZONE: z.string().default("Asia/Kolkata"),
  OWNER_WHATSAPP_NUMBER: z.string().optional(),
}).refine(
  (e) => Boolean(e.NEXT_PUBLIC_PUBLISHABLE_KEY ?? e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  { message: "Either NEXT_PUBLIC_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set" },
);

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten());
  throw new Error("Environment validation failed. See .env.example.");
}

export const env = parsed.data;
