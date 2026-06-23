# Screens & routes

Every page is a React Server Component that calls `requireOwner()`/`requireWorker()`, queries via
`createSupabaseServer()`, and renders with the UI kit. Mutations live in the sibling `actions.ts`.
To add a screen, copy the nearest one + its `actions.ts` and add the route to the nav.

## Marketing (`apps/web/src/app/`)
- `page.tsx` — landing page: hero + product photos (`next/image` from `public/`), capabilities, story,
  products, why-us, testimonials, FAQ, footer. Static, no auth, no DB. Logo via `BrandLogo`.

## Owner (`apps/web/src/app/owner/`)
Layout = grouped sidebar (desktop) + top nav (mobile) + a live "Farm status" chip. Nav defined in
`OwnerSidebar.tsx` (sidebar) and `OwnerNav.tsx` (mobile).

| Route | Shows | Actions (`actions.ts`) |
|---|---|---|
| `/owner/workspace` | Agent command-centre: KPIs, farm-check queue, run-context table | — (reuses `agent` action) |
| `/owner` (Today) | Status hero, KPI cards, quick actions, reminders, trend charts, insights | `agent/triggerDailyAgent` |
| `/owner/production` | Milk trend + log session + recent table | `logMilkSession` |
| `/owner/herd` + `/herd/[id]` | Animal grid + filters + add; detail (health, feed, yield, events) | `addAnimal` |
| `/owner/sales` | Today/week totals, add sale, recent sales, customers + quiet flag | `addSale`, `addCustomer` |
| `/owner/expenses` | 30-day total, category bars, add cost, recent list | `addExpense` |
| `/owner/reminders` | Grouped Today/Week/Later, add, mark done | `addReminder`, `markReminderDone` |
| `/owner/agent` | AI findings list + dismiss + run now | `triggerDailyAgent`, `dismissFinding` |
| `/owner/assistant` | Plain text → logged milk entry (LLM/regex parse) | `askAssistant` |
| `/owner/notifications` | Bell list, mark read (service-client; user-scoped) | `markNotificationRead`, `markAllNotificationsRead` |
| `/owner/login` | Email+password (primary) · magic link · Google | inline server actions |

## Worker (`apps/web/src/app/worker/`)
Mobile-first, big targets. Layout = simple top bar.

| Route | Shows | Actions |
|---|---|---|
| `/worker` (Home) | Greeting, shift, action tiles, reminders + mark done, success banner | `completeReminder` |
| `/worker/log/milk` | Animal + litres + fat; accepts Scan/Voice prefill via search params | `logMilkFromWorker` |
| `/worker/log/feed` · `/health` · `/wash` | Quick logs | `logFeed`, `logHealthEvent`, `logWash` |
| `/worker/scan` | Photo → Claude vision OCR → prefill milk form | `scanMilkSlip` |
| `/worker/voice` | Web Speech transcript → parse → prefill | `processVoice` |
| `/worker/login` | Name + PIN | inline server action |

## Realtime
Mount `<RealtimeRefresher tables={[...]} farmId={...} />` on any screen that should auto-update; it
`router.refresh()`es the RSC tree on Postgres changes (RLS still applies). Already on dashboards,
production, sales, expenses, reminders, workspace, worker home.
