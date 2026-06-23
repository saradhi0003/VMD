// Seed the demo auth users into LOCAL Supabase. The `handle_new_user` trigger
// (migration 0001) materialises each profile from user_metadata and assigns the
// lone Vayumukhi farm automatically. Run AFTER `supabase start` + migrations/seed.
//
//   pnpm db:test:seed        (loads ../../.env.test for the local URL + service key)
//
// Idempotent: re-running just reports the users already exist.
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../../.env.test", import.meta.url).pathname });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — fill .env.test from `supabase status`.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [
  { email: "admin@vayumukhi.in", password: "farm123", user_metadata: { name: "Owner", role: "owner" } },
  { email: "suresh@worker.vmd.local", password: "123456", user_metadata: { name: "Suresh", role: "worker" } },
];

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({ ...u, email_confirm: true });
  if (error && !/already|registered|exists/i.test(error.message)) {
    console.error(`failed: ${u.email} — ${error.message}`);
    process.exit(1);
  }
  console.log(`${error ? "exists " : "created"}: ${u.email}  (${u.user_metadata.role})`);
}
console.log("Demo auth users ready.");
