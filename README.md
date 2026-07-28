# Vayumukhi Dairy

Real-stack farm management for a family-owned Indian dairy.

## Stack

- **Frontend**: Next.js 15 (App Router, RSC) + TypeScript + Tailwind
- **Auth**: Supabase Auth (owner magic link / Google; worker PIN via synthetic email + password)
- **DB**: Supabase Postgres with RLS, accessed via `@supabase/supabase-js` + `@supabase/ssr`
- **Orchestration**: Inngest (cron + event-driven, durable steps)
- **LLM**: Anthropic Claude (Sonnet 4.6 for the daily farm-check)
- **Storage**: Supabase Storage (farm-scoped via RLS)
- **WhatsApp**: Meta Cloud API
- **Hosting**: Vercel

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layer-by-layer detail.

## Layout

```
apps/web/             Next.js — marketing + /owner + /worker + API routes
packages/supabase/    Supabase client factories + DB types
packages/llm/         Provider adapter (self-hosted | Claude), prompts, tools, extraction
packages/jobs/        Inngest functions + mailer
supabase/             SQL migrations + Supabase CLI config
mobile/               Capacitor native shell (iOS + Android)
infra/                Colab LLM server, docker-compose
skills/               Portable pattern docs (MFA + approval gate)
archive/              Not built, not served — kept for reference only
```

The legacy static prototype has been retired to [archive/prototype-2026-05/](archive/README.md) now
that the Next.js port is at parity.

## Local development

```bash
pnpm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL + the two keys (see SETUP.md)
pnpm dev
```

Apply schema once via Supabase Studio → SQL Editor:
1. Paste `supabase/migrations/20260529_000001_init.sql` → Run
2. Paste `supabase/migrations/20260529_000002_seed.sql` → Run

Then visit:
- http://localhost:3000 — marketing
- http://localhost:3000/owner — owner workspace
- http://localhost:3000/worker — worker workspace

## Env vars

Full walkthrough in [SETUP.md](SETUP.md).
