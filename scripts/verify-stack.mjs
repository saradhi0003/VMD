#!/usr/bin/env node
/**
 * End-to-end stack verification for Vayumukhi Dairy.
 *
 *   node scripts/verify-stack.mjs            # everything that doesn't need a running app
 *   APP_URL=http://localhost:3000 node scripts/verify-stack.mjs   # + API/header checks
 *
 * Hits the REAL Supabase project named in .env.local. Read-only except for two
 * clearly-marked probes (a milk_sessions insert and a TOTP enrol), both of which
 * clean up after themselves.
 *
 * Exit code 1 if any check FAILs. SKIPs never fail the run — they mean a
 * dependency (Colab, SMTP, Inngest) isn't configured, which is a valid state.
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

/* ── env ─────────────────────────────────────────────────────────────── */
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PK = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SK = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL || "";

const OWNER = { email: "admin@vayumukhi.in", password: "farm123" };
const WORKER = { email: "suresh@worker.vmd.local", password: "123456" };

/* ── tiny test runner ────────────────────────────────────────────────── */
const results = [];
let section = "";
const H = (s) => { section = s; console.log(`\n\x1b[1m── ${s} ${"─".repeat(Math.max(0, 58 - s.length))}\x1b[0m`); };
function record(status, name, detail) {
  results.push({ section, status, name, detail });
  const c = { PASS: "\x1b[32m✔", FAIL: "\x1b[31m✘", SKIP: "\x1b[33m•", WARN: "\x1b[33m▲" }[status];
  console.log(`  ${c} ${name}\x1b[0m${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}
async function check(name, fn) {
  try {
    const r = await fn();
    if (r && r.skip) return record("SKIP", name, r.skip);
    if (r && r.warn) return record("WARN", name, r.warn);
    record("PASS", name, typeof r === "string" ? r : "");
  } catch (e) {
    record("FAIL", name, e.message.slice(0, 160));
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ── helpers ─────────────────────────────────────────────────────────── */
const svc = (p, o = {}) => fetch(`${U}${p}`, { ...o, headers: { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", ...o.headers } });
const anon = (p, o = {}) => fetch(`${U}${p}`, { ...o, headers: { apikey: PK, "Content-Type": "application/json", ...o.headers } });
const user = (p, tok, o = {}) => fetch(`${U}${p}`, { ...o, headers: { apikey: PK, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", ...o.headers } });

async function signIn({ email, password }) {
  const r = await anon("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login failed for ${email}: ${JSON.stringify(j).slice(0, 120)}`);
  return j;
}
const jwtClaims = (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64").toString());

/** RFC-6238 TOTP — no dependency. */
function totp(secretBase32, at = Date.now()) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8);
  ctr.writeBigInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(ctr).digest();
  const off = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(off) & 0x7fffffff) % 1e6)).padStart(6, "0");
}

/* ════════════════════════════════════════════════════════════════════════
   1. CONFIG / DATA LAYER
   ════════════════════════════════════════════════════════════════════ */
H("Config + Data layer");
await check("Supabase URL + keys present", () => {
  assert(U && PK && SK, "missing NEXT_PUBLIC_SUPABASE_URL / publishable / secret key");
  return `${new URL(U).hostname}`;
});
await check("Auth service healthy", async () => {
  const r = await anon("/auth/v1/health");
  assert(r.ok, `HTTP ${r.status}`);
});
await check("PostgREST reachable with service key", async () => {
  const r = await svc("/rest/v1/farms?select=id&limit=1");
  assert(r.ok, `HTTP ${r.status}`);
});

let dbCounts = {};
await check("Core tables readable (service role)", async () => {
  const tables = ["farms", "profiles", "animals", "milk_sessions", "customers", "products", "sales", "expenses", "reminders", "scan_events", "voice_entries", "activity_logs", "agent_runs", "agent_findings", "audit_log"];
  const missing = [];
  for (const t of tables) {
    const r = await svc(`/rest/v1/${t}?select=*&limit=1000`);
    if (!r.ok) { missing.push(t); continue; }
    dbCounts[t] = (await r.json()).length;
  }
  assert(missing.length === 0, `unreadable: ${missing.join(", ")}`);
  return Object.entries(dbCounts).map(([k, v]) => `${k}:${v}`).join(" ");
});

/* ════════════════════════════════════════════════════════════════════════
   2. MIGRATION / APPROVAL GATE STATE
   ════════════════════════════════════════════════════════════════════ */
H("Approval gate (migration 0005)");
let gate0005 = false;
await check("profiles.status exists (migration 0004)", async () => {
  const r = await svc("/rest/v1/profiles?select=status&limit=1");
  assert(r.ok, (await r.json()).message);
});
await check("profiles.approved_at + notified_at exist (0005)", async () => {
  const r = await svc("/rest/v1/profiles?select=approved_at,notified_at&limit=1");
  if (!r.ok) throw new Error("migration 0005 NOT APPLIED — run it in Supabase Studio");
  gate0005 = true;
});
await check("is_approved() predicate installed (0005)", async () => {
  const r = await svc("/rest/v1/rpc/is_approved", { method: "POST", body: "{}" });
  if (r.status === 404) throw new Error("is_approved() missing — migration 0005 NOT APPLIED");
  assert(r.ok, `HTTP ${r.status}`);
});

/* ════════════════════════════════════════════════════════════════════════
   3. AUTH / LOGIN / MFA / TOTP
   ════════════════════════════════════════════════════════════════════ */
H("Login + MFA/TOTP");
let ownerTok, workerTok, ownerId;
await check("Owner password login", async () => {
  const s = await signIn(OWNER);
  ownerTok = s.access_token; ownerId = s.user.id;
  return `aal=${jwtClaims(ownerTok).aal} role=${jwtClaims(ownerTok).role}`;
});
await check("Worker (name+PIN) login", async () => {
  const s = await signIn(WORKER);
  workerTok = s.access_token;
  return `aal=${jwtClaims(workerTok).aal}`;
});
await check("Wrong password rejected", async () => {
  const r = await anon("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: OWNER.email, password: "wrong-" + Date.now() }) });
  assert(r.status === 400, `expected 400, got ${r.status}`);
});
await check("TOTP enrol → challenge → verify (full cycle)", async () => {
  const en = await user("/auth/v1/factors", ownerTok, { method: "POST", body: JSON.stringify({ factor_type: "totp", friendly_name: `verify-${Date.now()}` }) });
  const ej = await en.json();
  if (!en.ok) {
    if (JSON.stringify(ej).match(/disabled|not enabled/i)) return { skip: "TOTP disabled in Supabase dashboard" };
    throw new Error(JSON.stringify(ej).slice(0, 140));
  }
  const factorId = ej.id, secret = ej.totp.secret;
  try {
    const ch = await user(`/auth/v1/factors/${factorId}/challenge`, ownerTok, { method: "POST", body: "{}" });
    const cj = await ch.json();
    assert(ch.ok, `challenge failed: ${JSON.stringify(cj).slice(0, 120)}`);
    const vr = await user(`/auth/v1/factors/${factorId}/verify`, ownerTok, { method: "POST", body: JSON.stringify({ challenge_id: cj.id, code: totp(secret) }) });
    const vj = await vr.json();
    assert(vr.ok, `verify failed: ${JSON.stringify(vj).slice(0, 120)}`);
    const aal = jwtClaims(vj.access_token).aal;
    assert(aal === "aal2", `expected aal2 after verify, got ${aal}`);
    // reject a wrong code on a fresh challenge
    const ch2 = await user(`/auth/v1/factors/${factorId}/challenge`, vj.access_token, { method: "POST", body: "{}" });
    const cj2 = await ch2.json();
    const bad = await user(`/auth/v1/factors/${factorId}/verify`, vj.access_token, { method: "POST", body: JSON.stringify({ challenge_id: cj2.id, code: "000000" }) });
    assert(!bad.ok, "a wrong TOTP code was ACCEPTED");
    await user(`/auth/v1/factors/${factorId}`, vj.access_token, { method: "DELETE" }); // cleanup
    return "enrol→challenge→aal2 ok; bad code rejected; factor removed";
  } catch (e) {
    await user(`/auth/v1/factors/${factorId}`, ownerTok, { method: "DELETE" }).catch(() => {});
    throw e;
  }
});

/* ════════════════════════════════════════════════════════════════════════
   4. RLS / CRUD PERMISSIONS  (the "hacker proof" core)
   ════════════════════════════════════════════════════════════════════ */
H("RLS + CRUD permissions");
await check("Anonymous reads return ZERO rows on every table", async () => {
  const leaked = [];
  for (const t of ["profiles", "farms", "animals", "milk_sessions", "customers", "sales", "expenses", "audit_log", "scan_events"]) {
    const r = await anon(`/rest/v1/${t}?select=*&limit=5`);
    const j = await r.json().catch(() => []);
    if (Array.isArray(j) && j.length > 0) leaked.push(`${t}(${j.length})`);
  }
  assert(leaked.length === 0, `LEAKED to anon: ${leaked.join(", ")}`);
});
await check("Authenticated owner CAN read own farm", async () => {
  const r = await user("/rest/v1/milk_sessions?select=id&limit=5", ownerTok);
  const j = await r.json();
  assert(Array.isArray(j) && j.length > 0, `owner read nothing: ${JSON.stringify(j).slice(0, 120)}`);
  return `${j.length} milk rows visible`;
});
await check("Worker CAN read own farm", async () => {
  const r = await user("/rest/v1/animals?select=id&limit=5", workerTok);
  const j = await r.json();
  assert(Array.isArray(j), JSON.stringify(j).slice(0, 120));
  return `${j.length} animals visible`;
});
await check("Worker CANNOT insert an expense (owner-only policy)", async () => {
  const farmId = (await (await user("/rest/v1/profiles?select=farm_id", workerTok)).json())[0]?.farm_id;
  const r = await user("/rest/v1/expenses", workerTok, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ farm_id: farmId, occurred_at: new Date().toISOString(), category: "misc", amount_minor: 1, description: "RLS probe" }),
  });
  if (r.ok) {
    const j = await r.json();
    for (const row of j) await svc(`/rest/v1/expenses?id=eq.${row.id}`, { method: "DELETE" });
    throw new Error("worker INSERTED an expense — owner-only policy is not enforced");
  }
  return `blocked with HTTP ${r.status}`;
});
await check("Worker CAN insert a milk session (then cleaned up)", async () => {
  const farmId = (await (await user("/rest/v1/profiles?select=farm_id", workerTok)).json())[0]?.farm_id;
  const r = await user("/rest/v1/milk_sessions", workerTok, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ farm_id: farmId, session_date: new Date().toISOString().slice(0, 10), shift: "morning", litres: "0.01", source: "verify-script" }),
  });
  const j = await r.json();
  assert(r.ok, `worker insert blocked: ${JSON.stringify(j).slice(0, 140)}`);
  for (const row of j) await svc(`/rest/v1/milk_sessions?id=eq.${row.id}`, { method: "DELETE" });
  return "inserted + removed";
});
await check("Cross-farm write is rejected", async () => {
  const fake = "00000000-0000-0000-0000-0000000000ff";
  const r = await user("/rest/v1/milk_sessions", ownerTok, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ farm_id: fake, session_date: new Date().toISOString().slice(0, 10), shift: "morning", litres: "1.0" }),
  });
  if (r.ok) {
    for (const row of await r.json()) await svc(`/rest/v1/milk_sessions?id=eq.${row.id}`, { method: "DELETE" });
    throw new Error("wrote a row into another farm");
  }
  return `blocked with HTTP ${r.status}`;
});
await check("audit_log is not client-writable", async () => {
  const farmId = (await (await user("/rest/v1/profiles?select=farm_id", ownerTok)).json())[0]?.farm_id;
  const r = await user("/rest/v1/audit_log", ownerTok, { method: "POST", body: JSON.stringify({ farm_id: farmId, action: "forged", entity: "test" }) });
  assert(!r.ok, "a client forged an audit_log row");
  return `blocked with HTTP ${r.status}`;
});

/* ════════════════════════════════════════════════════════════════════════
   5. ATTACK SURFACE
   ════════════════════════════════════════════════════════════════════ */
H("Attack surface");
await check("Tampered JWT rejected", async () => {
  const parts = ownerTok.split(".");
  const claims = jwtClaims(ownerTok); claims.role = "service_role";
  const forged = `${parts[0]}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${parts[2]}`;
  const r = await user("/rest/v1/profiles?select=*", forged);
  const j = await r.json().catch(() => null);
  assert(!r.ok || (Array.isArray(j) && j.length === 0), "forged JWT was accepted");
  return `HTTP ${r.status}`;
});
await check("Expired/garbage bearer rejected", async () => {
  const r = await user("/rest/v1/profiles?select=*", "not-a-jwt");
  assert(!r.ok, `garbage token accepted (HTTP ${r.status})`);
  return `HTTP ${r.status}`;
});
await check("PostgREST filter injection does not escape RLS", async () => {
  const r = await anon("/rest/v1/profiles?select=*&id=neq.00000000-0000-0000-0000-000000000000&limit=50");
  const j = await r.json().catch(() => []);
  assert(!Array.isArray(j) || j.length === 0, `injection returned ${j.length} rows`);
});
await check("Secret key absent from built client bundle", async () => {
  const { execSync } = await import("node:child_process");
  let out = "";
  try {
    out = execSync(`grep -rl "${SK}" apps/web/.next/static apps/web/.next/server 2>/dev/null || true`, { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" });
  } catch { /* grep exit 1 = no match */ }
  if (!out.trim()) return "no leak in .next";
  throw new Error(`SECRET KEY FOUND IN BUILD: ${out.split("\n")[0]}`);
});

/* ════════════════════════════════════════════════════════════════════════
   6. EXTERNAL API KEYS  (raw HTTP — the code paths are covered by
      `pnpm verify:integration`, which runs under vitest's .js→.ts resolver)
   ════════════════════════════════════════════════════════════════════ */
H("External API keys");
// Which backend does the app actually use? Mirrors activeProvider() in
// packages/llm/src/provider.ts. Only that one is allowed to FAIL the run — the
// others are informational, since an unused key being stale breaks nothing.
const ACTIVE =
  process.env.LLM_PROVIDER ||
  (process.env.LLM_BASE_URL ? "openai-compat"
    : process.env.DEEPSEEK_API_KEY ? "deepseek"
    : process.env.ANTHROPIC_API_KEY ? "anthropic"
    : "none");
record("PASS", "Active LLM provider", ACTIVE);

await check("DEEPSEEK_API_KEY returns a real completion", async () => {
  if (!process.env.DEEPSEEK_API_KEY) return { skip: "DEEPSEEK_API_KEY unset" };
  let base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  if (!/\/v\d+$/.test(base)) base += "/v1";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    // Padded budget: these are reasoning models and will otherwise spend the
    // whole allowance thinking and return an empty string.
    body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: "user", content: "Reply with the single word: ok" }] }),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json();
  assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(j).slice(0, 140)}`);
  const txt = j.choices?.[0]?.message?.content ?? "";
  assert(txt.length > 0, "empty content — raise max_tokens (reasoning ate the budget)");
  return `${j.model} · in=${j.usage?.prompt_tokens} out=${j.usage?.completion_tokens} · "${txt.trim().slice(0, 20)}"`;
});

await check("Smart Scan has a vision-capable provider", async () => {
  if (ACTIVE === "deepseek") {
    return { warn: "DeepSeek is text-only — Smart Scan degrades to empty. Use Colab or Anthropic for photos." };
  }
  if (ACTIVE === "none") return { skip: "no provider configured" };
  return `${ACTIVE} supports images`;
});

await check("ANTHROPIC_API_KEY returns a real completion", async () => {
  if (!process.env.ANTHROPIC_API_KEY) return { skip: "ANTHROPIC_API_KEY unset" };
  if (ACTIVE !== "anthropic") {
    // Not the active backend — a stale key here breaks nothing.
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 8, messages: [{ role: "user", content: "ok" }] }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => null);
    if (r?.ok) return "usable (not the active provider)";
    const detail = r ? ((await r.json().catch(() => ({}))).error?.message ?? `HTTP ${r.status}`) : "unreachable";
    return { warn: `unusable, but not in use: ${String(detail).slice(0, 90)}` };
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5-20251001", max_tokens: 16, messages: [{ role: "user", content: "Reply with the single word: ok" }] }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json();
  assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(j).slice(0, 140)}`);
  return `${j.model} · in=${j.usage?.input_tokens} out=${j.usage?.output_tokens} · "${j.content?.[0]?.text?.trim().slice(0, 20)}"`;
});
await check("Self-hosted LLM (Colab) endpoint", async () => {
  const base = process.env.LLM_BASE_URL;
  if (!base || base === "undefined") return { skip: "LLM_BASE_URL unset — Colab notebook not running" };
  const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` }, signal: AbortSignal.timeout(15000) });
  assert(r.ok, `HTTP ${r.status}`);
  return (await r.json()).data?.[0]?.id ?? "reachable";
});
await check("INNGEST_EVENT_KEY", async () => {
  if (!process.env.INNGEST_EVENT_KEY) return { skip: "unset — jobs run via `npx inngest-cli dev` locally" };
  const r = await fetch(`https://inn.gs/e/${process.env.INNGEST_EVENT_KEY}`, { method: "POST", body: JSON.stringify({ name: "verify/ping", data: {} }), headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000) });
  assert(r.ok, `HTTP ${r.status}`);
});
await check("WHATSAPP_ACCESS_TOKEN", async () => {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { skip: "unset — WhatsApp send job no-ops" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20000) });
  assert(r.ok, `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return "token valid";
});
await check("SMTP credentials", async () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { skip: "SMTP_* unset — admin notifications skip by design (approval still works)" };
  }
  const net = await import("node:tls");
  const port = Number(process.env.SMTP_PORT || 465);
  const greeting = await new Promise((res, rej) => {
    const sock = net.connect({ host: process.env.SMTP_HOST, port, servername: process.env.SMTP_HOST }, () => {});
    sock.setTimeout(15000, () => { sock.destroy(); rej(new Error("timeout")); });
    sock.once("data", (d) => { sock.end(); res(d.toString().trim()); });
    sock.once("error", rej);
  });
  assert(/^220/.test(greeting), `unexpected greeting: ${greeting.slice(0, 80)}`);
  return greeting.slice(0, 60);
});

/* ════════════════════════════════════════════════════════════════════════
   8. APP LAYER (needs a running server)
   ════════════════════════════════════════════════════════════════════ */
H("App / API layer" + (APP ? ` @ ${APP}` : ""));
const app = (p, o) => fetch(`${APP}${p}`, { redirect: "manual", signal: AbortSignal.timeout(90000), ...o });
if (!APP) {
  record("SKIP", "App checks", "set APP_URL=http://localhost:3000 to enable");
} else {
  await check("/api/health responds", async () => {
    const r = await app("/api/health");
    assert(r.ok, `HTTP ${r.status}`);
    return JSON.stringify(await r.json()).slice(0, 120);
  });
  await check("Marketing page renders", async () => {
    const r = await app("/");
    assert(r.ok, `HTTP ${r.status}`);
    const html = await r.text();
    assert(/vayumukhi/i.test(html), "brand name not in HTML");
    return `${html.length} bytes`;
  });
  await check("Owner login page renders", async () => {
    const r = await app("/owner/login");
    assert(r.ok, `HTTP ${r.status}`);
    const h = await r.text();
    assert(/type="password"/.test(h), "no password field");
    assert(/type="email"/.test(h), "no email field");
    return "email + password fields present";
  });
  await check("Worker login page renders", async () => {
    const r = await app("/worker/login");
    assert(r.ok, `HTTP ${r.status}`);
    return "ok";
  });
  await check("/owner redirects anonymous to login", async () => {
    const r = await app("/owner");
    assert([302, 307, 308].includes(r.status), `expected redirect, got ${r.status}`);
    const loc = r.headers.get("location") || "";
    assert(/login/.test(loc), `redirected to ${loc}`);
    return `→ ${loc}`;
  });
  await check("/worker redirects anonymous to login", async () => {
    const r = await app("/worker");
    assert([302, 307, 308].includes(r.status), `expected redirect, got ${r.status}`);
    return `→ ${r.headers.get("location")}`;
  });
  await check("Security headers present", async () => {
    const r = await app("/");
    const csp = r.headers.get("content-security-policy");
    assert(csp, "no CSP header");
    const missing = ["default-src", "frame-ancestors"].filter((d) => !csp.includes(d));
    assert(missing.length === 0, `CSP missing ${missing.join(",")}`);
    return `CSP ok · XFO=${r.headers.get("x-frame-options") || "—"} · nosniff=${r.headers.get("x-content-type-options") || "—"}`;
  });
  await check("Secret key never served to the browser", async () => {
    const r = await app("/");
    const html = await r.text();
    assert(!html.includes(SK), "SERVICE KEY PRESENT IN HTML");
    assert(!html.includes("sb_secret"), "a secret-looking token is in the HTML");
    return "clean";
  });
  await check("WhatsApp webhook rejects a bad verify token", async () => {
    const r = await app("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123");
    assert(r.status === 403 || r.status === 401, `expected 401/403, got ${r.status}`);
    return `HTTP ${r.status}`;
  });
  await check("Open-redirect probe on ?next=", async () => {
    const r = await app("/mfa?next=https://evil.example.com/steal");
    const loc = r.headers.get("location") || "";
    assert(!/^https?:\/\/(?!localhost|127\.)/.test(loc), `redirects off-site to ${loc}`);
    return loc ? `→ ${loc}` : `HTTP ${r.status}, no off-site redirect`;
  });
}

/* ── summary ─────────────────────────────────────────────────────────── */
const n = (s) => results.filter((r) => r.status === s).length;
console.log(`\n\x1b[1m${"═".repeat(64)}\x1b[0m`);
console.log(`\x1b[1m  ${n("PASS")} passed · ${n("FAIL")} failed · ${n("WARN")} warnings · ${n("SKIP")} skipped\x1b[0m`);
if (n("FAIL")) {
  console.log("\n\x1b[31m  FAILURES:\x1b[0m");
  for (const r of results.filter((x) => x.status === "FAIL")) console.log(`   ✘ [${r.section}] ${r.name}\n     ${r.detail}`);
}
if (n("SKIP")) {
  console.log("\n\x1b[33m  SKIPPED (not configured):\x1b[0m");
  for (const r of results.filter((x) => x.status === "SKIP")) console.log(`   • ${r.name} — ${r.detail}`);
}
console.log();
process.exit(n("FAIL") ? 1 : 0);
