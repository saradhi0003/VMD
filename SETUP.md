# SETUP — filling in `.env.local`

Step-by-step for each env var. Minimal-dev block at the bottom.

---

## 1. Supabase (DB + Auth + Storage)

```env
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_URL=""
```

**Steps:**
1. Sign in at https://supabase.com/dashboard → **New project**.
2. Region: **South Asia (Mumbai) — ap-south-1**. Database password: pick a strong one and save it.
3. Wait ~1 minute for provisioning.
4. Open **Project Settings → API**. Copy:
   - **Project URL** → both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep secret — never expose to the browser)*

**Apply the schema (one-time):**
1. In the Supabase dashboard, **SQL Editor → New query**.
2. Open `supabase/migrations/20260529_000001_init.sql` from this repo, paste it all, run.
3. Open `supabase/migrations/20260529_000002_seed.sql`, paste, run. Creates the Vayumukhi farm + sample animals + products.

**Bootstrap your owner account:**
1. Visit http://localhost:3000/owner/login → enter your email → check inbox → click the magic link.
2. In Supabase **Table Editor → profiles**, find your row and set `role = 'owner'`. *(First user defaults to `worker`.)*

**Bootstrap a worker (one-off):**
1. **Authentication → Users → Add user**.
2. Email: `ravi@worker.vmd.local`, Password: a 4-digit PIN (e.g. `1234`). Auto-confirm.
3. The trigger creates a `profiles` row with role `worker` and farm_id assigned (if there's only one farm).
4. In `profiles`, set the `name` field to `Ravi` so the login form matches.
5. Worker logs in at `/worker/login` with `Ravi` + `1234`.

### Enable Google sign-in (optional)
- Supabase dashboard → **Authentication → Providers → Google → Enable**.
- Add your Google client ID + secret (created the same way as before: Google Cloud Console → OAuth client ID → web app).
- **Authorised redirect URI** in Google: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.

---

## 1b. SMTP (optional — admin access-request emails)

Two separate things, don't confuse them:

**Auth emails** (magic links, invites, OTP) — **dashboard only, no code**:
Supabase → **Authentication → Emails → SMTP settings**. Point it at Gmail (App Password) or
Resend/SendGrid so invites stop hitting Supabase's rate-limited default sender.

**Admin "someone requested access"** — env vars, delivered by the `access-request-notify` Inngest job:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="you@gmail.com"
SMTP_PASS=""          # Gmail App Password, NOT your account password
SMTP_FROM="Vayumukhi Dairy <you@gmail.com>"
ADMIN_EMAIL="you@gmail.com"
```
Leave blank and everything still works — the request appears in **/owner/team**, which is the source
of truth. Email is a convenience, never a dependency.

---

## 2. LLM — pick one (or neither)

### Option A — free, self-hosted (no card, no spend)

```env
LLM_PROVIDER="openai-compat"
LLM_BASE_URL="https://xxxx.trycloudflare.com/v1"
LLM_API_KEY=""
```

Open [`infra/colab/vayumukhi-llm-server.ipynb`](infra/colab/README.md) in Google Colab, set
**Runtime → T4 GPU**, run it top to bottom, and paste the block it prints. Serves Qwen2.5-VL-7B for
Smart Scan + the agent. Caveats: the URL rotates every session and scans take 30–90 s —
see [infra/colab/README.md](infra/colab/README.md).

### Option B — hosted Claude (costs money, much faster)

```env
ANTHROPIC_API_KEY=""
```

1. Sign up at https://console.anthropic.com.
2. Add payment method (daily agent ~$0.01–0.05/day at this farm's scale).
3. **API Keys → Create Key** → paste.

`LLM_BASE_URL` takes precedence when both are set. With **neither**, the app still runs: voice/assistant
use the offline regex parser and scans return an empty `other` result.

---

## 3. Inngest (orchestration)

```env
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""
```

**Local dev:** leave blank, run the Inngest dev server:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
# UI at http://localhost:8288
```

**Production:**
1. https://app.inngest.com → create app `vmd`.
2. Manage → **Event Keys → Create** → paste into `INNGEST_EVENT_KEY`.
3. Manage → **Signing Keys** → paste into `INNGEST_SIGNING_KEY`.
4. Apps → **Add app** → Sync URL: `https://YOUR-DOMAIN/api/inngest`.

---

## 4. WhatsApp (Meta Cloud API)

```env
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_VERIFY_TOKEN=""
WHATSAPP_BUSINESS_ACCOUNT_ID=""
```

1. https://developers.facebook.com → **My Apps → Create App** → Business type.
2. Add WhatsApp product. Copy **Phone number ID** + **Business Account ID** from the API Setup page.
3. Generate a permanent token via **Business Settings → System Users → New** (Admin role) → grant `whatsapp_business_messaging` + `whatsapp_business_management`. Paste into `WHATSAPP_ACCESS_TOKEN`.
4. `WHATSAPP_VERIFY_TOKEN`: pick any random string (`openssl rand -hex 16`).
5. Configure webhook: `https://YOUR-DOMAIN/api/webhooks/whatsapp` with the verify token. Subscribe to `messages` + `message_status`.

For local dev, expose localhost via cloudflared:
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 5. Misc

```env
NODE_ENV="development"
FARM_TIMEZONE="Asia/Kolkata"
OWNER_WHATSAPP_NUMBER="+91XXXXXXXXXX"
```

`OWNER_WHATSAPP_NUMBER` — your phone in E.164 format. The daily agent sends critical alerts here.

---

## Minimal local dev

Just these four are enough to boot the marketing page + auth:
```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="ey..."
SUPABASE_SERVICE_ROLE_KEY="ey..."
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
```

Then:
```bash
pnpm install
pnpm dev
```

Visit:
- http://localhost:3000 — marketing
- http://localhost:3000/owner/login — owner sign-in
- http://localhost:3000/worker/login — worker sign-in

## What can wait

- WhatsApp credentials (send job no-ops without them)
- Inngest signing keys (use the dev server locally)
- An LLM provider (only needed for the agent + Smart Scan; both degrade gracefully without one)
- Google OAuth (email magic link works on its own)
