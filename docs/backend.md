# Backend — auth, actions, clients, jobs, LLM

## Env
`.env.local` at the **repo root**, symlinked to `apps/web/.env.local` (Next loads env from the app dir).
Required: `NEXT_PUBLIC_SUPABASE_URL`, a publishable key, a secret key. Optional: `ANTHROPIC_API_KEY`
(scan/voice/agent), `INNGEST_*` (jobs in prod), `WHATSAPP_*`.

## Auth (`apps/web/src/lib/auth.ts`)
- Owner: email+password (primary) / magic link / Google. Worker: name + PIN → synthetic email
  (`workerEmail(name)`) + `signInWithPassword`. Don't change the email format (locks out existing workers).
- `getSession()` (no redirect), `requireOwner()`/`requireWorker()` (redirect guards). Middleware
  (`middleware.ts`) refreshes the session and gates `/owner` + `/worker`.

## Server Actions (the write API) — pattern
```
"use server"
requireOwner()/requireWorker()  → zod parse → mutate via createSupabaseServer()
→ recordAudit(...)              → emit({...})  → revalidatePath(...)
```
Reference: `apps/web/src/app/worker/log/milk/actions.ts`. Validate cross-farm refs with
`assertAnimalInFarm` (`lib/validate.ts`).

## Supabase clients (`@vmd/supabase`)
- `createServerClient` — RSC + actions, user-scoped (via `lib/supabase-server.ts`).
- `createBrowserClient` — realtime only.
- `createServiceClient` — jobs/webhooks/audit/notifications; **bypasses RLS**.
- The ssr clients **cast** to `SupabaseClient<Database>` (ssr 0.5 ⨯ supabase-js 2.106 type drift). Keep it.

## Orchestration (Inngest — `packages/jobs`)
- Client + event schemas in `client.ts`; functions in `functions/*`: `dailyAgentCron` (6 AM),
  `dailyAgentOnDemand`, `whatsappSend`, `quietCustomerCheck` (8:30 AM). Served at `/api/inngest`.
- **Always emit via `emit(...)`** (best-effort wrapper) — never raw `inngest.send`, so a missing key /
  unreachable dev server can't break a user action.
- Jobs only *run* if you start `npx inngest-cli dev -u http://localhost:3000/api/inngest` (local) or set
  `INNGEST_*` (prod). Otherwise events are logged, not executed.

## LLM (`@vmd/llm`)
- `anthropic` client; `MODEL_AGENT` = sonnet-4-6, `MODEL_FAST` = haiku-4-5.
- `runDailyAgent(snapshot)` (findings), `extractMilkFromImage` (vision OCR), `extractMilkFromText`
  (assistant/voice — **regex fallback when no API key**, so it works offline).
- Needs `ANTHROPIC_API_KEY` for the daily agent + Smart Scan vision; assistant/voice degrade gracefully.

## API routes (`app/api/*`)
`auth/callback`, `auth/signout`, `inngest`, `webhooks/whatsapp` (service client), `health`.
