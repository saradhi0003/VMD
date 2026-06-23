# TESTING.md — Vayumukhi Dairy

How we test, and **how Claude (Claude Code) drives the app** to test it and iterate while building.

There are two layers:

| Layer | Tool | What it covers | Needs |
|-------|------|----------------|-------|
| **Live drivers (MCP)** | Playwright MCP, Postgres MCP | Claude operates the running app + inspects the DB, live | dev server (+ local DB for Postgres MCP) |
| **Unit / integration** | Vitest | Pure backend logic — `packages/llm`, helpers, schemas | nothing (mocked/offline) |
| **End-to-end + API** | Playwright Test | Owner/worker flows, write paths, API routes | local Supabase + dev server |
| **Page-load perf** | Lighthouse (`playwright-lighthouse`) | Core Web Vitals / budgets on key routes | dev or prod server |

---

## Live drivers — how Claude tests & iterates (the main ask)

Configured in [`.mcp.json`](.mcp.json) at the repo root (checked in, shared). **Restart Claude Code**
after first checkout so the servers load, then the tools appear automatically.

- **Playwright MCP** (`@playwright/mcp`) — Claude opens a real browser, navigates `localhost:3000`,
  logs in as owner/worker, clicks, fills forms, reads the accessibility tree, screenshots, and reads
  console errors. This is how Claude *uses* the UI and confirms a change renders correctly, then fixes
  and repeats. Start the app first: `pnpm dev`.
- **Postgres MCP** (`@modelcontextprotocol/server-postgres`, **read-only**) — points at the local
  Supabase Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Claude runs SELECTs
  to confirm a server action actually wrote the right row, inspect schema, and check RLS. Requires
  `pnpm db:test:up` (below) to be running.

The built-in `/verify` and **run** skills pair with these: Claude boots the app, drives the browser,
checks the DB, fixes, and loops — no manual click-through from you.

---

## One-time setup

```bash
pnpm install                      # installs vitest, @playwright/test, playwright-lighthouse, lighthouse
pnpm --filter @vmd/web exec playwright install chromium   # browser binaries for E2E/perf
```

### Local Supabase (for E2E + Postgres MCP)
Requires a container runtime. This machine is macOS 12 / Intel with no Docker — see
[the runtime note](#container-runtime-on-this-machine) below.

```bash
pnpm db:test:up        # supabase start → Postgres :54322, Studio :54323, applies migrations
cp .env.test.example .env.test     # then paste the anon + service keys from `supabase status`
pnpm db:test:seed      # creates demo owner + worker auth users (the profile trigger does the rest)
```

`supabase init` is already done (`supabase/config.toml`). The SQL seed can't create `auth.users`, so
`db:test:seed` ([apps/web/scripts/seed-auth.mjs](apps/web/scripts/seed-auth.mjs)) calls the Auth Admin
API to create owner `admin@vayumukhi.in` / `farm123` and worker `Suresh` / PIN `123456`; the
`handle_new_user` trigger materialises each profile and assigns the lone farm. `pnpm db:test:reset`
re-applies migrations + seed for a clean slate (re-run `db:test:seed` after).

---

## Running the suites

```bash
pnpm test            # Vitest — fast, offline, no DB. Always keep green.
pnpm test:e2e        # Playwright E2E + API routes (needs local Supabase + dev server)
pnpm test:perf       # Lighthouse budgets on key routes
pnpm test:all        # all three
```

Playwright auto-starts `pnpm dev` (see `webServer` in `apps/web/playwright.config.ts`) and reuses an
already-running server. `global-setup.ts` logs in once as owner + worker and saves
`tests/.auth/*.json`; specs `test.use({ storageState })` to skip per-test logins.

### What's covered today
- **Vitest** — `packages/llm/src/extract.test.ts` (offline regex fallback for scan/voice). Extend by
  adding `*.test.ts` next to source. To unit-test the zod schemas in `actions.ts`, extract the inline
  `Input` schema to a `schema.ts` and import it from both the action and the test.
- **E2E** — owner dashboard/production render; **worker logs a milk session end-to-end** (form →
  server action insert → redirect); API: `/api/health`, WhatsApp webhook verify + no-op POST.
- **Perf** — marketing home + worker home against Lighthouse budgets.

---

## Keeping the suite fast, free, deterministic
- **No `ANTHROPIC_API_KEY` in `.env.test`** → scan/voice extraction uses the offline regex fallback;
  no cost, no flakiness.
- **External side-effects** (WhatsApp send, Inngest `inngest.send`) fire from some server actions. If
  they throw in the test environment, add a test-mode guard (e.g. skip when `process.env.TEST_MODE`)
  in `packages/jobs/src/functions/whatsapp-send.ts` and around `inngest.send` calls, or intercept the
  network in Playwright. The milk-log E2E exercises this path — watch for it.
- Perf thresholds in `tests/perf/load.spec.ts` are lenient for `next dev`; run against
  `pnpm --filter @vmd/web build && pnpm --filter @vmd/web start` and raise them for real numbers.

---

## Container runtime on this machine
macOS 12.7.6 / Intel. Current Docker Desktop needs macOS 13+, so install the **last Monterey-compatible
build, Docker Desktop 4.41.2** (4.42.0 raised the floor to Ventura 13.3):

- Intel `.dmg`: <https://desktop.docker.com/mac/main/amd64/191736/Docker.dmg>
- Install → drag to Applications → launch → accept the license → wait for the whale icon to settle.

Then `pnpm db:test:up` works. Until Docker is running, the **Vitest layer and Playwright MCP still work
without it** (MCP can drive the app against the existing cloud Supabase); only the write-path E2E and
Postgres MCP need the local DB.
