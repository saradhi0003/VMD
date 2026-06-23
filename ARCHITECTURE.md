# Vayumukhi Dairy — Architecture

A single Next.js 15 application (pnpm/Turbo monorepo) serving three surfaces from one codebase and one
database:

- **Marketing site** (`/`) — public, for retail milk customers.
- **Owner workspace** (`/owner/*`) — full farm visibility: production, herd, money, sales, reminders, the
  daily AI farm-check, and team/access management.
- **Worker workspace** (`/worker/*`) — big-button, task-at-a-time logging for the shed.

Backed by **Supabase** (Postgres + Auth + Storage + Realtime), orchestrated by **Inngest**, augmented by
**Anthropic Claude**. UI is the **"Pure"** design system — navy / sky-blue / white, thin serif display,
mono micro-labels. Authentication is **invite-only with mandatory TOTP MFA**.

| Layer | Pick |
|---|---|
| Hosting | Vercel |
| Frontend / App | Next.js 15 (App Router, React Server Components) · TypeScript · Tailwind CSS |
| Design system | "Pure" — navy `#173a5c` / blue `#3f93cf` / white; Instrument Serif · Schibsted Grotesk · Spline Sans Mono |
| Auth | Supabase Auth — **invite/admin-only** creation · owner email+password · worker name+PIN · **TOTP MFA required for all** |
| Database | Supabase Postgres (multi-tenant by `farm_id`, RLS on every table) |
| Data access | `@supabase/supabase-js` + `@supabase/ssr` (RSC, Server Actions, jobs, webhooks) |
| Realtime | Supabase Realtime → server-refresh subscriber (`RealtimeRefresher`) |
| Charts | Recharts (lazy-loaded — milk trend, revenue/expense, sparklines) |
| Orchestration | Inngest (cron + event-driven, durable steps) |
| LLM | Anthropic Claude (Sonnet 4.6 daily agent · Haiku 4.5 scan/voice; regex fallback offline) |
| Storage | Supabase Storage (`photos`, `voice` buckets — farm-scoped via RLS) |
| Messaging | Meta Cloud API (WhatsApp) |
| Testing | Vitest (unit) · Playwright (E2E + Lighthouse) · Playwright/Postgres MCP (live drivers) |
| Build | Turbo monorepo · pnpm workspaces |

## Repo layout
```
apps/web/
  src/app/                 routes — RSC pages, layouts, route handlers, server actions
    page.tsx               marketing landing (real product photos via next/image, BrandLogo)
    owner/                 workspace · (today) · production · herd[/id] · sales · expenses ·
                           reminders · agent · assistant · notifications · team · login
    worker/                home · log/{milk,feed,health,wash} · scan · voice · login
    mfa/ · mfa/enroll/     TOTP challenge + enrolment (client)
    onboard/               invited user sets password
    auth/accept-invite/    invite link landing (exchanges code)
    api/                   auth/{callback,signout} · inngest · webhooks/whatsapp · health
  src/components/ui/        Pure kit (Button, Card, StatCard, Field, SeverityBadge, BrandLogo, ProductArt …)
  src/components/charts/    Recharts + charts/lazy (dynamic, ssr:false)
  src/lib/                  auth, supabase-server, audit, validate, env, series
  public/                   logo.svg + product/hero photos
packages/
  supabase/                server / browser / service clients + hand-rolled DB types
  llm/                     Claude client, prompts, tools, daily agent, scan/voice + regex extraction
  jobs/                    Inngest client (client.ts, exports emit()) + functions
supabase/
  config.toml              CLI config (+ [auth.mfa])
  migrations/              0001 init · 0002 seed · 0003 fixes/realtime · 0004 user status
docs/                      CLAUDE.md router → screens · design-system · data-model · backend · working-with-claude
```

**Contributor notes** (also in `CLAUDE.md` + `docs/`)
- Workspace packages use NodeNext ESM (`./x.js` → `x.ts`); `next.config.ts` sets a webpack `extensionAlias`
  + `transpilePackages`.
- Inngest client lives in `packages/jobs/src/client.ts` (separate from the barrel) to avoid a build-breaking
  cycle; it exports **`emit()`** (best-effort send).
- `packages/supabase/src/types.ts` is hand-rolled but conforms to supabase-js `GenericSchema`.

---

# Layered architecture

## 1. Presentation Layer (UI)
Next.js **App Router** with **React Server Components** by default; only interactive widgets are `"use client"`.

**Screens.** Marketing (hero, capabilities, story, products, why-us, testimonials, FAQ, footer). Owner
(grouped **sidebar** on desktop / scrollable top nav on mobile, with a live "Farm status" chip):
**Workspace** (agent command-centre: KPIs, check queue, run-context table) · **Today** (status hero, KPI
cards, quick actions, reminders, trend charts, insights) · **Production** · **Herd** + animal detail ·
**Sales & customers** (quiet-customer flag) · **Costs/expenses** (category bars) · **Reminders** ·
**Alerts** (AI findings) · **Assistant** (text→entry) · **Notifications** · **Team & access**. Worker
(mobile-first big tiles): home, log milk/feed/health/wash, scan, voice.

**"Pure" design system.** Tokens in `globals.css` + `tailwind.config.ts` (surfaces, ink, navy/blue, ok/warn,
radii). Type via `next/font` (Instrument Serif display · Schibsted Grotesk UI · Spline Sans Mono labels).
Kit in `components/ui/*` (Button, Card, StatCard, Field/Input/Select/Textarea, SeverityBadge,
PageHeader, EmptyState, **BrandLogo** → `/logo.svg`, ProductArt SVGs). Real product/hero photos via
**`next/image`** from `public/`. Charts imported from **`charts/lazy`** (`dynamic(ssr:false)`) so Recharts
stays out of first load (owner dashboard ~172 kB). `RealtimeRefresher` keeps screens live. A11y: focus
rings, `aria-live` on save banners, `prefers-reduced-motion`.

## 2. API / Application Layer
No separate API server — Next **Route Handlers** + **Server Actions** + **middleware**.

**Middleware** (`middleware.ts`, matcher `/owner/*` + `/worker/*`): refreshes the session, then gates:
unauthenticated → login; **disabled** account → login; non-owner on `/owner` → `/worker`; and **MFA/AAL**
— no verified factor → `/mfa/enroll`, factor-but-not-stepped-up → `/mfa` (see §8). The `profiles.status`
read falls back to role-only if migration 0004 isn't applied (MFA still enforced).

**Route handlers** (`api/*`): `auth/callback`, `auth/signout`, `inngest`, `webhooks/whatsapp` (service
client), `health`. Plus `auth/accept-invite` (invite landing).

**Server Actions** (`"use server"`) are the write API: `requireOwner()/requireWorker()` → zod → mutate →
`recordAudit()` → **`emit(...)`** (best-effort Inngest) → `revalidatePath`. Inventory: worker logs
(milk/feed/health/wash, scan, voice), `completeReminder`; owner `logMilkSession`, `triggerDailyAgent`,
`dismissFinding`, sales (`addSale`/`addCustomer`), `addExpense`, reminders (`addReminder`/`markReminderDone`),
`askAssistant`, notifications (mark read), **team** (`inviteUser`, `addWorker`, `setUserRole`,
`setUserStatus`), `addAnimal`.

## 3. Business Logic Layer
`apps/web/src/lib/*` + server actions + `@vmd/llm`.
- **Auth/session** (`lib/auth.ts`): `getSession`, `requireOwner/Worker`, `workerEmail(name)`, and
  **`mfaRequiredFor(role)`** (the single switch — currently `true` for all).
- **Authorization**: middleware + guards + RLS (defense in depth).
- **Validation** (`lib/validate.ts`): `assertAnimalInFarm()`; zod schemas per action.
- **Auditing** (`lib/audit.ts`): `recordAudit()` via the **service client** (tamper-resistant), never throws.
- **Ledger rules**: `milk_sessions/sales/expenses` append-only; corrections via `reverses_id`. Scan/voice
  link back via `applied_session_id`.
- **Env validation** (`lib/env.ts`): zod-validates env at boot.

## 4. Data Access Layer
`@vmd/supabase` — three clients by context: **server** (RSC/actions, user-scoped, via `lib/supabase-server.ts`),
**browser** (realtime + the MFA `auth.mfa.*` flows), **service** (jobs/webhooks/audit/admin — **bypasses RLS**).
The ssr clients cast to `SupabaseClient<Database>` (ssr 0.5 ⨯ supabase-js 2.106 type drift). Storage buckets
`photos`/`voice` are farm-path-scoped.

## 5. Database Layer (Supabase Postgres)
Migrations in `supabase/migrations/`:
- `0001 init` — tables, enums, RLS, `handle_new_user` trigger, storage buckets.
- `0002 seed` — farm + base animals/products.
- `0003 fixes/realtime` — `animal_health_events.farm_id` + worker insert; `audit_log` insert lockdown;
  `activity_logs`; dismiss-finding + complete-reminder update policies; `voice_entries.audio_url` nullable;
  `supabase_realtime` publication.
- `0004 user status` — **`profiles.status`** (`invited|active|disabled`) + index; **owner UPDATE policy on
  `profiles`** (manage role/status within the farm).

**Tables**: farms · profiles · animals · animal_health_events · milk_sessions · customers · products · sales
· expenses · reminders · notifications · whatsapp_messages · agent_runs · agent_findings · audit_log ·
scan_events · voice_entries · activity_logs. **Enums**: role · animal_type · animal_status · health_status ·
shift · reminder_priority · reminder_type · whatsapp_status · agent_finding_severity.

**RLS**: helpers `current_farm_id()`/`current_role()`; read = farm-scoped; books are owner-only writes; any
member can log milk/health/activity/scan/voice + complete reminders; owners dismiss findings + (0004)
update member role/status; `audit_log` insert is service-role only; `notifications` are user-scoped (read
via service client). Service role bypasses RLS for jobs/webhooks/admin.

## 6. LLM Layer (`@vmd/llm`)
`anthropic` client; `MODEL_AGENT` sonnet-4-6, `MODEL_FAST` haiku-4-5. `runDailyAgent(snapshot)` → findings
(tool-forced). `extractMilkFromImage` (vision OCR). `extractMilkFromText` (assistant/voice) with a **regex
fallback** when `ANTHROPIC_API_KEY` is unset, so the app never hard-fails offline.

## 7. Orchestration Layer (Inngest — `@vmd/jobs`)
Served at `/api/inngest`. Events: `farm/daily-agent.requested`, `milk-session/created`,
`customer/quiet-detected`, `whatsapp/send.requested`. Functions: `dailyAgentCron` (6 AM),
`dailyAgentOnDemand`, `whatsappSend` (idempotent), `quietCustomerCheck` (8:30 AM). All app emits go through
**`emit()`** (logs failures, never throws) so a missing INNGEST key never breaks a user action. Jobs only
*run* with the Inngest dev CLI (local) or `INNGEST_*` keys (prod).

---

# 8. Authentication, Authorization & MFA

**Account creation — invite/admin-only.** No public sign-up. The owner provisions everyone from
`/owner/team` (service-client actions): **invite staff/co-owner by email**
(`auth.admin.inviteUserByEmail` → `profiles.status='invited'`), or **add a worker** (`auth.admin.createUser`
with synthetic email + PIN). The `handle_new_user` trigger materialises each profile from invite/create
metadata (`farm_id`, `name`, `role`). Owners can change role and enable/disable accounts (`status`).

**Complete sign-up (invite acceptance).** Email link → `/auth/accept-invite` (exchanges the code) →
`/onboard` (set password ≥ 8 chars, flips `status='active'`) → `/mfa/enroll`.

**Login.** Owner = email + password (primary) / magic link / Google. Worker = name + PIN (synthetic email).
Both then face MFA.

**MFA — TOTP, required for everyone.** Native Supabase `auth.mfa.*` (browser client):
- `/mfa/enroll` — `enroll({factorType:'totp'})` → render `totp.qr_code` → user scans (Authenticator/Authy/
  1Password) → `challenge` + `verify` → session steps up to **aal2**.
- `/mfa` — for users with a verified factor: `challenge` + code → aal2.
- **Enforcement** in middleware via `getAuthenticatorAssuranceLevel()`: `nextLevel==='aal1'` (no factor) →
  enrol; `currentLevel!=='aal2'` → challenge. Gated by `mfaRequiredFor(role)` (flip to owners-only by
  returning `role!=='worker'`).

**Authorization.** Roles `owner | worker | read_only`; RLS enforces farm isolation at the DB; middleware +
`requireOwner/Worker` gate routes/actions; disabled accounts are bounced; `/owner/team` is owner-only.

> Tradeoff (as configured): workers do name+PIN **then** a TOTP code from their phone on the shared shed
> device — secure but high-friction. Relax to owners-only in one line (`mfaRequiredFor`).

---

# Cross-cutting concerns
**Security.** RLS + farm isolation; invite-only creation; **mandatory MFA (aal2)**; account disable; audit
log (service-role insert); HSTS/CSP/X-Frame-Options/nosniff in `next.config.ts`; secrets server-only.

**Configuration.** `.env.local` at repo root, symlinked to `apps/web/.env.local`. Required: Supabase URL +
publishable + secret keys. Optional: `ANTHROPIC_API_KEY`, `INNGEST_*`, `WHATSAPP_*`, `NEXT_PUBLIC_SITE_URL`
(invite redirect base).

**Build correctness.** extensionAlias, transpilePackages, jobs cycle broken via client.ts, GenericSchema
types, lazy charts, client pages using `useSearchParams` wrapped in `<Suspense>`.

## Key end-to-end flows
1. **Invite → onboard → MFA.** Owner invites → email link → accept-invite → set password → enrol TOTP →
   land in `/owner`. Profile `invited → active`.
2. **MFA login.** Sign in (password / PIN) → middleware sees aal1 → `/mfa` → correct code → aal2 → app.
3. **Worker logs milk → owner sees it live.** `logMilkFromWorker` → insert + audit + `emit(milk-session/
   created)` → owner dashboard `RealtimeRefresher` refreshes in ~1s.
4. **Smart Scan / Daily agent** — as before (vision OCR → confirm; cron → snapshot → findings).

## Testing (see TESTING.md)
- **Vitest** — offline unit tests (`extract.test.ts`). `pnpm test`. ✅ green.
- **Playwright E2E + API + Lighthouse** — `tests/e2e`, `tests/perf`; need local Supabase (Docker) + browsers.
- **Playwright/Postgres MCP** (`.mcp.json`) — Claude drives the live app + inspects the DB; load after a
  Claude Code restart. `pnpm typecheck` + `pnpm build` are the always-on gates (both green).

---

# Production readiness

**Done / green:** typecheck + build + Vitest green; layered app complete; enterprise auth (invite + MFA +
roles + disable); realtime; lazy charts + optimised images; resilient orchestrator (`emit`); LLM offline
fallback; security headers + RLS.

**Required before go-live (blockers):**
1. **Align Supabase** — apply **all** migrations incl. **0004** (cloud DB currently lacks `profiles.status`);
   enable **MFA (TOTP)** for the project; configure **SMTP** (custom provider) so invite/auth emails send
   reliably (built-in is rate-limited).
2. **Secrets/env on Vercel** — Supabase URL + keys, `NEXT_PUBLIC_SITE_URL`, `ANTHROPIC_API_KEY` (scan/voice/
   agent), `INNGEST_*` (jobs), `WHATSAPP_*` (messaging). Rotate any keys exposed in dev.
3. **Auth URLs** — set Supabase **Site URL** + **Redirect URLs** to the production domain (`/api/auth/
   callback`, `/auth/accept-invite`).
4. **Remove demo artefacts** — seeded demo data + demo logins; delete legacy static files (`app.html`, etc.).

**Recommended hardening:** error/loading boundaries (`error.tsx`/`loading.tsx`); a proper RLS read policy
for `notifications`; Sentry + log drain + Vercel Analytics; run the Playwright E2E in CI; `manifest.webmanifest`;
optional DB-level `aal2` RLS for sensitive tables; ESLint config (`pnpm lint` is currently non-functional).

---

# Deploy (Vercel + Supabase) and connecting a domain

1. **Supabase** — project in Mumbai; run migrations `0001 → 0002 → 0003 → 0004`; enable Realtime on the
   published tables; enable **MFA/TOTP**; set up SMTP.
2. **Vercel** — import the repo; set all env vars; build is `pnpm build`.
3. **Custom domain** — add it in Vercel → DNS (CNAME/A) → wait for TLS. Then set
   `NEXT_PUBLIC_SITE_URL=https://<domain>`, and in **Supabase Auth** set Site URL + Redirect URLs to that
   domain (`/api/auth/callback`, `/auth/accept-invite`). Update WhatsApp webhook + Inngest Sync URL to the
   domain.
4. **Inngest** — create app, set `INNGEST_*`, point Sync URL at `https://<domain>/api/inngest`.
5. **Anthropic / WhatsApp** — keys into Vercel env; configure the Meta webhook.

# Local development
```bash
pnpm install
pnpm dev            # http://localhost:3000   (.env.local at repo root, symlinked into apps/web)
pnpm typecheck      # keep green
pnpm test           # Vitest
```
First-time DB: apply migrations 0001–0004 in Studio, then create the first owner via the Auth Admin API /
seed and enrol MFA. Demo: owner `admin@vayumukhi.in` / `farm123`, worker `Suresh` / PIN `123456` (both must
enrol MFA on next login once required).
