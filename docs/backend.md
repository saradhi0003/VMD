# Backend — auth, actions, clients, jobs, LLM

## Env
`.env.local` at the **repo root**, symlinked to `apps/web/.env.local` (Next loads env from the app dir).
Required: `NEXT_PUBLIC_SUPABASE_URL`, a publishable key, a secret key. Optional: `LLM_*` **or**
`ANTHROPIC_API_KEY` (scan/voice/agent — see LLM below), `INNGEST_*` (jobs in prod), `WHATSAPP_*`.

## Env validation
`src/lib/env.ts` (zod) is imported by **`src/instrumentation.ts`**, Next's boot hook, so a bad config
fails at server start rather than as a mystery 500 later. Node runtime only — middleware boots the
edge runtime too, and a throw there would take down routing over a var edge code never reads.

Optional vars use a `blank()` helper that maps `""` → `undefined`: `.env.example` ships every optional
var as `FOO=""`, and plain `.optional()` treats that as *present*, so an unset `SUPABASE_URL` used to
fail `.url()` and would have taken the whole app down.

## Approval gate (migration 0005)
**The load-bearing invariant: UI gates are UX, the real lock is in the database.**
Every data policy reads `farm_id = current_farm_id() AND is_approved()`, so an authenticated but
unapproved account reads **zero rows** — verified with a raw SQL session, not just in the browser.

- `is_approved()` / `is_farm_owner()` — `SECURITY DEFINER` predicates (definer avoids RLS recursion).
- `status`: `pending | invited | active | disabled`. `is_approved()` ⇔ `status = 'active'`.
  Self-signups land `pending`; owner-provisioned accounts (metadata carries `farm_id`) land `active`.
- **Backend twin** — `apps/web/src/lib/guard.ts`. The service key bypasses RLS, so anything holding it
  must re-verify the JWT (`getUserIdFromAuthHeader`) and re-check approval (`requireApproved`) itself,
  then stamp writes with the *verified* id. Also exports `assertSameFarm` and `rateLimit`.
- **Screens** — `/pending` (waiting room, best-effort "notify the owner") and the Access-requests
  panel at the top of `/owner/team` (`decideAccessRequest`).
- Pattern doc + gotchas: [skills/mfa-totp/](../skills/mfa-totp/SKILL.md).

## Session lifetime
- **Web** — `lib/useIdleLogout.ts` signs out after 20 min idle (Supabase refreshes a JWT forever
  otherwise). Clock is persisted to `localStorage` so a closed tab still counts as idle; mounted via
  `components/IdleLogout.tsx` in both authed layouts.
- **Native shell** — `components/AppLock.tsx` re-locks behind Face ID / fingerprint on cold start and
  after 60 s backgrounded. **If no biometric is enrolled it lets the user in** — the session (AAL2) +
  RLS are the real lock; never hard-lock someone out of their own farm.

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
Two interchangeable backends behind one adapter — `chatJson()` in `src/provider.ts`. Both return the
model's answer as a **JSON string** in `.text`, so callers parse identically.

`activeProvider()` picks one:

`providerChain()` returns **every** configured backend, ordered **free → cheap → expensive**:

| Order | Provider | Configured by | Cost |
|---|---|---|---|
| 1 | `openai-compat` | `LLM_BASE_URL` | free (self-hosted / Colab) |
| 2 | `deepseek` | `DEEPSEEK_API_KEY` | cheap |
| 3 | `anthropic` | `ANTHROPIC_API_KEY` | expensive |
| — | `none` | nothing set | callers use their offline fallbacks |

**It's a chain, not a winner.** `chatJson` walks it and falls through on *any* failure —
a dead Colab tunnel, an expired key and an empty credit balance are indistinguishable from the call
site and all mean "this tier can't serve the request". This matters because the free tier is also the
least reliable: a Colab tunnel dies on idle and its URL rotates every session. Each fall-through logs
`[llm] <tier> failed, falling back to <next>`.

Set `LLM_PROVIDER` to pin one backend and **disable fall-through** — useful when reproducing a bug
against a specific model, wrong for normal running.

`DEEPSEEK_BASE_URL` is deliberately separate from `LLM_BASE_URL`: both tiers can be active at once,
and sharing the variable would point DeepSeek at the Colab tunnel.

### Capabilities — not every backend can do everything
`capabilities()` in `provider.ts` records what each backend actually supports,
**verified against the live APIs**. Getting these wrong fails at runtime, not compile time.

| | vision | json_schema | reasoning tokens |
|---|---|---|---|
| `openai-compat` (vLLM) | ✅ | ✅ grammar-constrained | — |
| `anthropic` | ✅ | ✅ via forced tool | — |
| `deepseek` | ❌ rejects `image_url` | ❌ `json_object` only | ✅ burns budget before answering |

Consequences, all handled:
- **Smart Scan needs vision, and the chain is capability-aware.** An image request filters the chain
  to vision-capable tiers *first*, so a scan skips DeepSeek and uses Colab or Anthropic automatically
  — even though DeepSeek leads for text. Only when **no** tier can see do
  `scanDocument`/`extractMilkFromImage` degrade to the empty result and log why; they never throw
  (golden rule 5). Voice, assistant and the daily agent are unaffected either way.
- **Without `json_schema`** the schema is inlined into the prompt and `json_object` guarantees valid
  JSON but *not our shape* — so `parseJson`/`parseScan` become load-bearing again rather than a
  belt-and-braces net.
- **Reasoning models** spend completion tokens thinking first; budgets are padded ×4 (min 2048) or
  `content` comes back empty with `finish_reason: "length"`.
- `runDailyAgent` validates findings **individually** and drops malformed ones, so one bad field
  can't discard a whole run — a real failure seen with DeepSeek putting an animal *name* in
  `related_entity_id`.

- **Free path:** run `infra/colab/vayumukhi-llm-server.ipynb` (Qwen2.5-VL-7B-AWQ on a Colab T4) and
  paste its `LLM_*` output into `.env.local`. See [infra/colab/README.md](../infra/colab/README.md)
  for the caveats — the URL rotates each session and scans take 30–90 s.
- **Entry points:** `runDailyAgent(snapshot)` → findings (schema-forced). `scanDocument(base64, mediaType)`
  → the multi-document Smart Scan classify+extract (`milk_sheet | feed_sheet | expense | other`), used by
  `apps/web/src/lib/scan.ts`. `extractMilkFromText(transcript)` → assistant/voice, with a **regex
  fallback** when no provider is configured, so it works fully offline.
  (`extractMilkFromImage` is the older single-slip vision path — exported but currently unused.)
- **Structured output:** schemas live in `src/tools.ts`. On `openai-compat` they go out as
  `response_format: json_schema`, which grammar-constrains decoding (invalid JSON is impossible); on
  `anthropic` the same schema is sent as one forced tool. `parseJson`/`parseScan` remain as the safety net.
- **Timeout:** `LLM_TIMEOUT_MS` (default 120 s) — a free T4 is far slower than hosted Claude.
- Every call site try/catches and degrades. The LLM must never break a user action (golden rule 5).

## Smart Scan flow (`apps/web/src/lib/scan.ts`)
`/owner/scan` and `/worker/scan` run the same pipeline and differ only in guard + redirects, so the
shared half lives here: `ScanMilkRows`/`ScanFeedRows` (zod), `runScanUpload`, `confirmMilkFromScan`,
`confirmFeedFromScan`. The two `"use server"` files are thin wrappers.
**`redirect()` stays in the route actions** — it works by throwing, so keeping it at the call site
stops a helper from silently swallowing or triggering control flow. `confirmExpense` is owner-only.

## Uploads (`apps/web/src/lib/upload.ts`)
`validateUpload(file, userId)` — allow-list of image extensions/MIME (accepts either, because iOS
sends HEIC and Android often sends an empty `type`), a 10 MB cap, and a 12-scan/min rate limit.
`next.config.ts` → `bodySizeLimit` must stay **above** `MAX_UPLOAD_BYTES` or Next returns an opaque
413 before the validator runs. Error codes map to copy via `SCAN_ERROR_MESSAGES`.

## Email / SMTP
Two layers, only one of which is code:
1. **Auth emails** (magic links, invites) — Supabase dashboard → Auth → Emails → SMTP settings. No code.
2. **Admin "access requested"** — `packages/jobs/src/mailer.ts` + the `access-request-notify` Inngest
   function on the `user/access.requested` event. **Best-effort**: unset SMTP → clean skip, and
   `notified_at` is stamped *only on a successful send* so a failure can retry. Approval never depends
   on email — the owner's Team panel is the source of truth. Env: `SMTP_*`, `ADMIN_EMAIL`.

## API routes (`app/api/*`)
`auth/callback`, `auth/signout`, `inngest`, `webhooks/whatsapp` (service client), `health`.
