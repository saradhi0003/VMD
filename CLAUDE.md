# CLAUDE.md — Vayumukhi Dairy

A family-dairy app: one Next.js 15 app (pnpm/Turbo monorepo) serving a **marketing site** (`/`), an
**owner workspace** (`/owner/*`), and a **worker workspace** (`/worker/*`), backed by **Supabase**
(Postgres + Auth + Storage + Realtime), **Inngest** (jobs), and **Anthropic Claude**. UI is the **"Pure"**
design system (navy/blue/white; Instrument Serif · Schibsted Grotesk · Spline Sans Mono).

## 🧭 Where to look — read only what your task needs (this is how you save tokens)
| Working on… | Read |
|---|---|
| A screen / route / feature flow | [docs/screens.md](docs/screens.md) |
| UI, styling, components, charts | [docs/design-system.md](docs/design-system.md) |
| Database, tables, RLS, migrations, seed | [docs/data-model.md](docs/data-model.md) |
| Auth, server actions, Supabase clients, Inngest, LLM | [docs/backend.md](docs/backend.md) |
| Big-picture / layered architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Tests (Vitest / Playwright / Lighthouse) | [TESTING.md](TESTING.md) |
| Native mobile shell (Capacitor iOS/Android) | [mobile/README.md](mobile/README.md) |
| First-time setup / provisioning | [SETUP.md](SETUP.md) |
| **Spending fewer Claude tokens on this repo** | [docs/working-with-claude.md](docs/working-with-claude.md) |

> Don't load every doc. Pick the one row that matches the task. CLAUDE.md (this file) is the only doc that
> loads automatically — keep it short.

## Commands
```bash
pnpm dev          # http://localhost:3000 (run from apps/web or root)
pnpm typecheck    # tsc across all packages — KEEP GREEN
pnpm build        # prod build — do NOT run while `pnpm dev` is live (corrupts .next; clear it + restart)
```

## Golden rules (don't break these)
1. **RSC by default**; only interactive bits are `"use client"`. Reads happen server-side.
2. **Server Actions are the write API**: `requireOwner()/requireWorker()` → zod parse → mutate →
   `recordAudit()` → `emit(...)` (never `inngest.send`) → `revalidatePath`. Pattern: `app/worker/log/milk/actions.ts`.
3. **RLS is authz** — everything is farm-scoped; bypass only via the **service client** (jobs/webhooks/audit).
4. **UI** from `@/components/ui` + Pure tokens (`navy/blue/ink/surface/line`, `font-serif`, `eyebrow`). No off-palette colours/fonts.
5. **Orchestrator + LLM are best-effort**: `emit()` swallows Inngest failures; the LLM degrades to a regex
   fallback without `ANTHROPIC_API_KEY`. Never let either break a user action.
6. Keep `pnpm typecheck` green. **Don't commit/push unless asked.**

## Demo logins (DB must have migrations applied — see SETUP.md)
- Owner → `/owner/login` · `admin@vayumukhi.in` / `farm123`
- Worker → `/worker/login` · name `Suresh` / PIN `123456` (PINs are ≥6 digits; Supabase min password length)

## Gotchas (one-liners — details in docs/backend.md)
- `packages/supabase/src/types.ts` must satisfy supabase-js `GenericSchema` (each table has `Relationships`).
- The ssr server/browser clients **cast** to `SupabaseClient<Database>` (ssr 0.5 ⨯ supabase-js 2.106 drift).
- Inngest client lives in `packages/jobs/src/client.ts` (avoids a barrel cycle that crashes the build).
- `next.config.ts` sets webpack `extensionAlias` (`.js`→`.ts`) + `transpilePackages`.
- `recordAudit` + `audit_log` are service-role-only; don't change `workerEmail()` format.
- Logo: `apps/web/public/logo.svg` (replace to rebrand). The app **can't** ingest an image pasted in chat.
- **MFA** is enforced only when `MFA_ENFORCED=true` (off in dev/tests); otherwise password login is enough.
- **Local test DB** (macOS 12): `export DOCKER_API_VERSION=1.49` before `pnpm db:test:*` (engine is API 1.49, CLI wants 1.51); the storage container health-check can false-negative — see [TESTING.md](TESTING.md).
